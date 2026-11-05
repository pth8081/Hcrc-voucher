const { sql, getPool } = require('../config/db');
const ExcelJS = require('exceljs');
const coreVoucherService = require('./coreVoucherService');
const companyService = require('./companyService');
const apiConnectionService = require('./apiConnectionService');
const emailGatewayService = require('./emailGatewayService');

const { VOUCHER_STATUS } = coreVoucherService;

// Moi voucher can 1 lan goi API rieng toi Core (khong co API "kiem tra nhieu ma 1 luc") - gioi
// han chan de 1 lan doi soat khong lam treo server/qua tai Core khi ai do chon khoang ngay qua
// rong. Can khoang ngay hep hon neu vuot qua.
const MAX_VOUCHERS_PER_RUN = 1000;

// Dem 1 nhip tho giua 2 lan goi Core lien tiep - goi LIEN TUC khong nghi co the bi Core hieu
// nham la tan cong do/qua tai, khac han quet tay cua con nguoi (luon co khoang nghi tu nhien).
const CALL_DELAY_MS = Number(process.env.CORE_RECONCILE_DELAY_MS || 150);

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.publicMessage = message;
  return err;
}

function forbidden(message) {
  const err = new Error(message);
  err.statusCode = 403;
  err.publicMessage = message;
  return err;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Cung 1 mau voi emailScheduleService.js#parseRecipients - tach chuoi nguoi dung go (cach nhau
 * dau phay/cham phay/khoang trang), validate tung email, khu trung. */
function parseRecipients(raw) {
  const list = String(raw || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const invalid = list.filter((e) => !EMAIL_RE.test(e));
  if (invalid.length) throw badRequest(`Email khong hop le: ${invalid.join(', ')}`);
  if (!list.length) throw badRequest('Can it nhat 1 email nguoi nhan');
  return Array.from(new Set(list));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pham vi he thong (connectionIds) THAT SU duoc phep doi soat cua nguoi goi - doc TRUC TIEP tu
 * req.reconcileScope/req.reconcileConnectionId (middleware requireReconcileCoreAccess.js da tinh
 * san tu CSDL, KHONG tin gia tri client gui len) de chan truoc khi dua vao truy van/luu Run - Quan
 * tri doi tac KHONG the vuot qua pham vi 1 he thong da gan cho ho du co gui gi trong body.
 *
 * Tra ve: null = khong loc gi (tat ca he thong - CHI xay ra voi scope ALL khi khong chon rieng he
 * thong nao), hoac 1 mang id (1 hoac nhieu, luon CHINH XAC 1 phan tu voi scope CONNECTION).
 */
function resolveConnectionIds(req, requestedConnectionIds) {
  if (req.reconcileScope === 'CONNECTION') return [req.reconcileConnectionId];
  if (!Array.isArray(requestedConnectionIds) || !requestedConnectionIds.length) return null;
  return requestedConnectionIds.map(Number).filter((id) => Number.isInteger(id) && id > 0);
}

function normalizeDate(value, label) {
  if (!value) throw badRequest(`Thieu ${label}`);
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) throw badRequest(`${label} khong hop le`);
  return value;
}

/**
 * Danh sach voucher DA THU HOI tren he thong nay (VOUCHER_SYNC) trong pham vi da chon - moi dong
 * cua bang nay DA la 1 voucher da redeem qua app, nen KHONG can loc them theo trang thai. Dung
 * CHUNG 1 mau JOIN voi usedVoucherReportService.js#listUsedVouchers (Locations_Detail ->
 * RedemptionUnits -> RedemptionCompanies de ra Cong ty/Diem tieu, VoucherRedemptionConnections de
 * ra he thong THAT SU da dung cho giao dich do - 2 nhanh JOIN DOC LAP, khong phai quan he cha-con).
 */
async function listCandidateVouchers({ connectionIds, companyId, fromDate, toDate, maxRows }) {
  const pool = await getPool();
  const request = pool.request();
  request.input('maxRows', sql.Int, maxRows);
  request.input('fromDate', sql.Date, fromDate);
  request.input('toDate', sql.Date, toDate);

  let extraFilter = '';
  if (companyId) {
    request.input('companyId', sql.Int, companyId);
    extraFilter += ' AND rc.Id = @companyId';
  }
  if (connectionIds && connectionIds.length) {
    const placeholders = connectionIds.map((id, i) => {
      request.input(`connId${i}`, sql.Int, id);
      return `@connId${i}`;
    });
    extraFilter += ` AND vrc.ConnectionId IN (${placeholders.join(', ')})`;
  }

  const result = await request.query(`
    SELECT TOP (@maxRows)
      vs.TRANS_NUM, vs.Voucher_Code, vs.User_Name, vs.Created_Date,
      rc.CompanyName, ru.PartnerName, vs.Location_DetailName, vs.Locations_Detail, vrc.ConnectionId
    FROM dbo.VOUCHER_SYNC vs
    LEFT JOIN (
      SELECT id, LTRIM(RTRIM(LocationCode)) AS LocationCode,
        ROW_NUMBER() OVER (
          PARTITION BY LTRIM(RTRIM(LocationCode))
          ORDER BY CASE WHEN EXISTS (SELECT 1 FROM dbo.RedemptionUnits ru0 WHERE ru0.LocationDetailId = d.id) THEN 0 ELSE 1 END, id
        ) AS rn
      FROM dbo.Locations_Detail d
    ) ld ON ld.LocationCode = LTRIM(RTRIM(vs.Locations_Detail)) AND ld.rn = 1
    LEFT JOIN dbo.RedemptionUnits ru ON ru.LocationDetailId = ld.id
    LEFT JOIN dbo.RedemptionCompanies rc ON rc.Id = ru.CompanyId
    LEFT JOIN dbo.VoucherRedemptionConnections vrc ON vrc.TransNum = vs.TRANS_NUM
    WHERE CAST(vs.Created_Date AS DATE) >= @fromDate AND CAST(vs.Created_Date AS DATE) <= @toDate${extraFilter}
    ORDER BY vs.Created_Date DESC
  `);

  return result.recordset.map((row) => ({
    transNum: row.TRANS_NUM,
    voucherCode: row.Voucher_Code,
    userName: row.User_Name,
    createdDate: row.Created_Date,
    companyName: row.CompanyName || null,
    pointName: row.PartnerName || row.Location_DetailName || row.Locations_Detail || null,
    connectionId: row.ConnectionId || null,
  }));
}

/** Uoc tinh so voucher trong pham vi da chon TRUOC KHI chay thu that - dung de canh bao vuot
 * MAX_VOUCHERS_PER_RUN ngay tren man hinh thiet lap, truoc khi nguoi dung bam "Bat dau doi soat". */
async function estimateCount(req, { companyId, connectionIds: requestedConnectionIds, fromDate, toDate }) {
  const from = normalizeDate(fromDate, 'ngay bat dau');
  const to = normalizeDate(toDate, 'ngay ket thuc');
  if (new Date(from) > new Date(to)) throw badRequest('Ngay bat dau phai truoc hoac bang ngay ket thuc');
  const connectionIds = resolveConnectionIds(req, requestedConnectionIds);
  const rows = await listCandidateVouchers({ connectionIds, companyId, fromDate: from, toDate: to, maxRows: MAX_VOUCHERS_PER_RUN + 1 });
  return { count: Math.min(rows.length, MAX_VOUCHERS_PER_RUN), exceedsLimit: rows.length > MAX_VOUCHERS_PER_RUN };
}

async function buildScopeLabel({ companyId, connectionIds }) {
  let companyLabel = 'Tất cả công ty';
  if (companyId) {
    const companies = await companyService.list();
    const match = companies.find((c) => Number(c.Id) === Number(companyId));
    companyLabel = match ? match.CompanyName : companyLabel;
  }
  let systemLabel = '';
  if (connectionIds && connectionIds.length) {
    const options = await apiConnectionService.listOptions();
    const names = connectionIds.map((id) => {
      const match = options.find((o) => Number(o.id) === Number(id));
      return match ? match.name : null;
    }).filter(Boolean);
    if (names.length) systemLabel = ` (${names.join(', ')})`;
  }
  return `${companyLabel}${systemLabel}`;
}

async function createRun(pool, { userId, username, connectionId, companyId, companyName, scopeLabel, fromDate, toDate, totalCount }) {
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('username', sql.NVarChar(100), username)
    .input('connectionId', sql.Int, connectionId || null)
    .input('companyId', sql.Int, companyId || null)
    .input('companyName', sql.NVarChar(200), companyName || null)
    .input('scopeLabel', sql.NVarChar(300), scopeLabel)
    .input('fromDate', sql.Date, fromDate)
    .input('toDate', sql.Date, toDate)
    .input('totalCount', sql.Int, totalCount)
    .query(`
      INSERT INTO dbo.CoreReconciliationRuns
        (CreatedByUserId, CreatedByUsername, ConnectionId, CompanyId, CompanyName, ScopeLabel, FromDate, ToDate, Status, TotalCount)
      OUTPUT INSERTED.Id
      VALUES (@userId, @username, @connectionId, @companyId, @companyName, @scopeLabel, @fromDate, @toDate, 'RUNNING', @totalCount)
    `);
  return result.recordset[0].Id;
}

async function insertResult(pool, runId, voucher, matchResult, coreStatus, coreMessage) {
  await pool
    .request()
    .input('runId', sql.Int, runId)
    .input('voucherCode', sql.NVarChar(50), voucher.voucherCode)
    .input('transNum', sql.NVarChar(50), voucher.transNum || null)
    .input('companyName', sql.NVarChar(200), voucher.companyName || null)
    .input('pointName', sql.NVarChar(200), voucher.pointName || null)
    .input('redeemedByUserName', sql.NVarChar(100), voucher.userName || null)
    .input('redeemedDate', sql.DateTime2, voucher.createdDate || null)
    .input('coreStatus', sql.NVarChar(30), coreStatus || null)
    .input('coreMessage', sql.NVarChar(500), coreMessage || null)
    .input('matchResult', sql.NVarChar(10), matchResult)
    .query(`
      INSERT INTO dbo.CoreReconciliationResults
        (RunId, VoucherCode, TransNum, CompanyName, PointName, RedeemedByUserName, RedeemedDate, CoreStatus, CoreMessage, MatchResult)
      VALUES (@runId, @voucherCode, @transNum, @companyName, @pointName, @redeemedByUserName, @redeemedDate, @coreStatus, @coreMessage, @matchResult)
    `);
}

async function bumpProgress(pool, runId, { checkedCount, matchCount, mismatchCount }) {
  await pool
    .request()
    .input('runId', sql.Int, runId)
    .input('checkedCount', sql.Int, checkedCount)
    .input('matchCount', sql.Int, matchCount)
    .input('mismatchCount', sql.Int, mismatchCount)
    .query('UPDATE dbo.CoreReconciliationRuns SET CheckedCount = @checkedCount, MatchCount = @matchCount, MismatchCount = @mismatchCount WHERE Id = @runId');
}

async function finishRun(pool, runId, status, errorMessage) {
  await pool
    .request()
    .input('runId', sql.Int, runId)
    .input('status', sql.NVarChar(20), status)
    .input('errorMessage', sql.NVarChar(500), errorMessage || null)
    .query('UPDATE dbo.CoreReconciliationRuns SET Status = @status, ErrorMessage = @errorMessage, FinishedDate = GETDATE() WHERE Id = @runId');
}

/**
 * Chay NEN (khong await boi noi goi) - goi lai Core cho TUNG voucher TUAN TU (co nghi giua 2
 * lan goi, xem CALL_DELAY_MS), ghi ket qua tung dong NGAY sau khi co phan hoi (khong doi het roi
 * ghi 1 lan) de tien trinh con do du server co su co giua chung. 1 voucher loi (Core khong goi
 * duoc/he thong da bi xoa...) CHI tinh la "CHUA KHOP" cho RIENG voucher do, KHONG lam dung ca
 * lan doi soat - loi ha tang that su (vd mat ket noi DB) moi lam FAILED toan bo lan chay.
 */
async function runReconciliation(runId, candidates) {
  const pool = await getPool();
  let checkedCount = 0;
  let matchCount = 0;
  let mismatchCount = 0;
  try {
    for (const voucher of candidates) {
      let coreStatus = null;
      let coreMessage = null;
      let matchResult = 'MISMATCH';
      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await coreVoucherService.checkVoucher(voucher.voucherCode, { connectionId: voucher.connectionId });
        coreStatus = result.status;
        coreMessage = result.message || null;
        matchResult = result.status === VOUCHER_STATUS.USED ? 'MATCH' : 'MISMATCH';
      } catch (err) {
        coreStatus = 'ERROR';
        coreMessage = err.publicMessage || err.message || 'Khong goi duoc Core';
      }

      checkedCount += 1;
      if (matchResult === 'MATCH') matchCount += 1;
      else mismatchCount += 1;

      // eslint-disable-next-line no-await-in-loop
      await insertResult(pool, runId, voucher, matchResult, coreStatus, coreMessage);
      // eslint-disable-next-line no-await-in-loop
      await bumpProgress(pool, runId, { checkedCount, matchCount, mismatchCount });

      if (checkedCount < candidates.length) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(CALL_DELAY_MS);
      }
    }
    await finishRun(pool, runId, 'DONE', null);
  } catch (err) {
    await finishRun(pool, runId, 'FAILED', err.message || 'Loi khong xac dinh');
  }
}

/** Tao 1 dong Run moi (Status=RUNNING) cho 1 danh sach voucher da xac dinh san - dung chung boi
 * startRun() (nguoi dung bam nut, chay NEN) va runReconciliationForSchedule() (lich gui email tu
 * dong, chay DOI KET QUA LUON vi can dinh kem file Excel vao email ngay). KHONG tu goi
 * runReconciliation() - noi goi tu quyet dinh await hay chay nen tuy tinh huong. */
async function createRunForCandidates({ userId, username, companyId, connectionIds, fromDate, toDate, candidates }) {
  let companyName = null;
  if (companyId) {
    const companies = await companyService.list();
    const match = companies.find((c) => Number(c.Id) === Number(companyId));
    companyName = match ? match.CompanyName : null;
  }
  const scopeLabel = await buildScopeLabel({ companyId, connectionIds });
  // Cot ConnectionId tren Run CHI luu duoc 1 id (dung de loc lich su cho scope CONNECTION, luon
  // dung DUNG 1 id) - truong hop scope ALL chon NHIEU he thong cung luc, luu NULL (khong loc lich
  // su theo cot nay, ScopeLabel da mo ta day du cac he thong da chon de nguoi xem con biet).
  const singleConnectionId = connectionIds && connectionIds.length === 1 ? connectionIds[0] : null;

  const pool = await getPool();
  return createRun(pool, {
    userId,
    username,
    connectionId: singleConnectionId,
    companyId: companyId || null,
    companyName,
    scopeLabel: `${scopeLabel} · ${fromDate} - ${toDate}`,
    fromDate,
    toDate,
    totalCount: candidates.length,
  });
}

/** Bat dau 1 lan doi soat moi - tao dong Run (Status=RUNNING) roi TRA VE NGAY runId, qua trinh
 * goi Core thuc te chay o nen (khong giu request HTTP cho den khi xong - co the mat vai phut voi
 * so luong lon). Frontend tu poll GET /:id de theo doi tien trinh. */
async function startRun(req, { companyId, connectionIds: requestedConnectionIds, fromDate, toDate }) {
  const from = normalizeDate(fromDate, 'ngay bat dau');
  const to = normalizeDate(toDate, 'ngay ket thuc');
  if (new Date(from) > new Date(to)) throw badRequest('Ngay bat dau phai truoc hoac bang ngay ket thuc');

  const connectionIds = resolveConnectionIds(req, requestedConnectionIds);
  const candidates = await listCandidateVouchers({ connectionIds, companyId, fromDate: from, toDate: to, maxRows: MAX_VOUCHERS_PER_RUN });
  if (!candidates.length) {
    throw badRequest('Khong co voucher nao da thu hoi trong pham vi da chon - vui long doi lai cong ty/he thong/khoang ngay.');
  }

  const runId = await createRunForCandidates({
    userId: req.user.userId, username: req.user.username, companyId, connectionIds, fromDate: from, toDate: to, candidates,
  });

  // Khong await - chay nen, tra ve runId NGAY de frontend bat dau poll tien trinh.
  runReconciliation(runId, candidates).catch(() => {});

  return { runId, totalCount: candidates.length };
}

function scopeWhereClause(req) {
  if (req.reconcileScope === 'ALL') return '';
  return ' WHERE ConnectionId = @scopeConnectionId';
}

/** Lich su cac lan doi soat - Quan tri HCRC (scope ALL) thay TAT CA (ke ca do Quan tri doi tac
 * khac chay), Quan tri doi tac (scope CONNECTION) CHI thay cac lan gan voi DUNG he thong cua ho -
 * cung quy uoc "ALL thay het, CONNECTION chi thay cua minh" voi emailScheduleService.js#resolveViewerScope. */
async function listRuns(req, limit = 20) {
  const pool = await getPool();
  const request = pool.request().input('limit', sql.Int, limit);
  if (req.reconcileScope === 'CONNECTION') request.input('scopeConnectionId', sql.Int, req.reconcileConnectionId);
  const result = await request.query(`
    SELECT TOP (@limit) Id, CreatedByUsername, CreatedDate, ScopeLabel, FromDate, ToDate,
           Status, TotalCount, CheckedCount, MatchCount, MismatchCount, ErrorMessage
    FROM dbo.CoreReconciliationRuns${scopeWhereClause(req)}
    ORDER BY CreatedDate DESC
  `);
  return result.recordset.map((row) => ({
    id: row.Id,
    createdByUsername: row.CreatedByUsername,
    createdDate: row.CreatedDate,
    scopeLabel: row.ScopeLabel,
    fromDate: row.FromDate,
    toDate: row.ToDate,
    status: row.Status,
    totalCount: row.TotalCount,
    checkedCount: row.CheckedCount,
    matchCount: row.MatchCount,
    mismatchCount: row.MismatchCount,
    errorMessage: row.ErrorMessage,
  }));
}

async function getRunRow(req, runId) {
  const pool = await getPool();
  const request = pool.request().input('runId', sql.Int, runId);
  if (req.reconcileScope === 'CONNECTION') request.input('scopeConnectionId', sql.Int, req.reconcileConnectionId);
  const result = await request.query(`
    SELECT Id, CreatedByUsername, CreatedDate, ScopeLabel, FromDate, ToDate,
           Status, TotalCount, CheckedCount, MatchCount, MismatchCount, ErrorMessage
    FROM dbo.CoreReconciliationRuns
    WHERE Id = @runId${req.reconcileScope === 'CONNECTION' ? ' AND ConnectionId = @scopeConnectionId' : ''}
  `);
  return result.recordset[0] || null;
}

async function listRunResults(runId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('runId', sql.Int, runId)
    .query(`
      SELECT VoucherCode, TransNum, CompanyName, PointName, RedeemedByUserName, RedeemedDate, CoreStatus, CoreMessage, MatchResult
      FROM dbo.CoreReconciliationResults
      WHERE RunId = @runId
      ORDER BY Id ASC
    `);
  return result.recordset.map((row) => ({
    voucherCode: row.VoucherCode,
    transNum: row.TransNum,
    companyName: row.CompanyName,
    pointName: row.PointName,
    redeemedByUserName: row.RedeemedByUserName,
    redeemedDate: row.RedeemedDate,
    coreStatus: row.CoreStatus,
    coreMessage: row.CoreMessage,
    matchResult: row.MatchResult,
  }));
}

/** Chi tiet 1 lan doi soat (dung cho ca man "Xem lai" tu lich su VA poll tien trinh dang chay) -
 * tra THEM ket qua chi tiet (results, co the rong neu con RUNNING) de frontend khong can goi 2 API. */
async function getRun(req, runId) {
  const row = await getRunRow(req, runId);
  if (!row) return null;
  const results = row.Status === 'RUNNING' ? [] : await listRunResults(runId);
  return {
    id: row.Id,
    createdByUsername: row.CreatedByUsername,
    createdDate: row.CreatedDate,
    scopeLabel: row.ScopeLabel,
    fromDate: row.FromDate,
    toDate: row.ToDate,
    status: row.Status,
    totalCount: row.TotalCount,
    checkedCount: row.CheckedCount,
    matchCount: row.MatchCount,
    mismatchCount: row.MismatchCount,
    errorMessage: row.ErrorMessage,
    results,
  };
}

/** Giong getRun() nhung KHONG kiem tra pham vi theo req - dung cho 2 noi goi NOI BO, dang tin cay
 * (lich gui email tu dong vua tao chinh Run nay; sendRunEmail() da tu kiem tra pham vi RIENG qua
 * getRun() truoc khi goi ham nay) - KHONG duoc expose truc tiep ra controller/route nao. */
async function getRunInternal(runId) {
  const pool = await getPool();
  const result = await pool.request().input('runId', sql.Int, runId).query(`
    SELECT Id, CreatedByUsername, CreatedDate, ScopeLabel, FromDate, ToDate,
           Status, TotalCount, CheckedCount, MatchCount, MismatchCount, ErrorMessage
    FROM dbo.CoreReconciliationRuns WHERE Id = @runId
  `);
  const row = result.recordset[0];
  if (!row) return null;
  const results = await listRunResults(runId);
  return {
    id: row.Id, createdByUsername: row.CreatedByUsername, createdDate: row.CreatedDate, scopeLabel: row.ScopeLabel,
    fromDate: row.FromDate, toDate: row.ToDate, status: row.Status, totalCount: row.TotalCount, checkedCount: row.CheckedCount,
    matchCount: row.MatchCount, mismatchCount: row.MismatchCount, errorMessage: row.ErrorMessage, results,
  };
}

/**
 * Chay 1 lan doi soat NGAY TRONG LUC CHO (await het, KHONG chay nen nhu startRun()) - dung boi
 * emailScheduleService.js#buildReportAttachment khi 1 lich gui email loai "Doi soat cheo Core" den
 * han, vi can co KET QUA DAY DU de dinh kem file Excel vao email ngay, khong the tra ve truoc roi
 * poll nhu man hinh tuong tac. Job nen gui email (emailScheduler.js) da chap nhan 1 lot gui co the
 * mat vai phut (xem ghi chu `running` guard o do) nen cho append o day la an toan.
 *
 * connectionIds: lay THANG tu emailScheduleService.js#resolveScheduleScope (KHONG di qua
 * resolveConnectionIds() - ham do danh cho man hinh tuong tac, coi mang RONG la "nguoi dung bo
 * chon = xem tat ca"; o day mang RONG (khac null) nghia la quyen he thong cua chu lich DA BI LOC
 * HET (vd bi thu hoi quyen sau khi tao lich) - phai hieu la "khong con gi duoc phep xem", KHONG
 * phai "xem tat ca" - neu khong se vo tinh lo du lieu vuot qua quyen hien tai cua chu lich.
 */
async function runReconciliationForSchedule({ userId, username, companyId, connectionIds, fromDate, toDate }) {
  const candidates = (Array.isArray(connectionIds) && connectionIds.length === 0)
    ? []
    : await listCandidateVouchers({ connectionIds, companyId, fromDate, toDate, maxRows: MAX_VOUCHERS_PER_RUN + 1 });

  if (candidates.length > MAX_VOUCHERS_PER_RUN) {
    throw badRequest(`Vuot qua gioi han ${MAX_VOUCHERS_PER_RUN} voucher/lan doi soat - vui long thu hep pham vi (cong ty/he thong/khoang ngay) cua lich gui nay.`);
  }
  if (!candidates.length) {
    throw badRequest('Khong co voucher nao da thu hoi trong pham vi lich gui nay - khong co gi de doi soat/gui email.');
  }

  const runId = await createRunForCandidates({ userId, username, companyId, connectionIds, fromDate, toDate, candidates });
  await runReconciliation(runId, candidates);
  return getRunInternal(runId);
}

/**
 * Gui ket qua 1 lan doi soat DA CHAY XONG qua email - thao tac THU CONG (nguoi dung tu bam nut
 * "Gui email" sau khi xem ket qua tren man hinh, tu chon nguoi nhan NGAY LUC DO) - KHAC voi lich
 * gui tu dong dinh ky (emailScheduleService.js, xem runReconciliationForSchedule() o tren). Dung
 * lai getRun(req, runId) de kiem tra PHAM VI (Quan tri doi tac chi gui duoc lan chay cua he thong
 * minh) truoc khi gui - khong tin rieng runId nguoi dung goi len.
 */
async function sendRunEmail(req, runId, recipientsRaw) {
  const run = await getRun(req, runId);
  if (!run) throw badRequest('Khong tim thay lan doi soat nay');
  if (run.status !== 'DONE') throw badRequest('Lan doi soat nay chua chay xong, vui long doi roi gui lai');
  const recipients = parseRecipients(recipientsRaw);

  const buffer = await buildExcelBuffer(run);
  const rangeLabel = run.fromDate === run.toDate ? run.fromDate : `${run.fromDate} đến ${run.toDate}`;
  const subject = `[HCRC Voucher] Đối soát chéo Core - ${rangeLabel}`;
  const html = `
    <p>Xin chào,</p>
    <p>Đây là kết quả đối soát chéo Core từ Hệ thống thu hồi voucher HCRC.</p>
    <p><b>Phạm vi:</b> ${run.scopeLabel || '-'}</p>
    <p><b>Tổng số:</b> ${run.totalCount} voucher · <b>Khớp:</b> ${run.matchCount} · <b>Chưa khớp:</b> ${run.mismatchCount}</p>
    <p>Chi tiết xem trong file Excel đính kèm.</p>
    <p style="color:#888;font-size:12px">Email này được gửi thủ công từ màn hình "Đối soát chéo Core" bởi ${req.user.username} - không cần phản hồi.</p>
  `;
  await emailGatewayService.sendMail({
    to: recipients.join(', '),
    subject,
    html,
    attachments: [{ filename: `doi-soat-core-${runId}.xlsx`, content: Buffer.from(buffer) }],
  });
}

const FORMULA_PREFIX_REGEX = /^[=+\-@\t\r]/;
function sanitizeExcelText(value) {
  if (value === null || value === undefined) return value;
  const str = String(value);
  return FORMULA_PREFIX_REGEX.test(str) ? `'${str}` : str;
}

const CORE_STATUS_LABELS = {
  [VOUCHER_STATUS.USED]: 'Đã dùng (USED)',
  [VOUCHER_STATUS.UNUSED]: 'Chưa dùng (UNUSED)',
  [VOUCHER_STATUS.EXPIRED]: 'Hết hạn (EXPIRED)',
  [VOUCHER_STATUS.CANCELLED]: 'Đã hủy (CANCELLED)',
  [VOUCHER_STATUS.NOT_FOUND]: 'Không tìm thấy',
  ERROR: 'Không gọi được Core',
};

/** Xuat ket qua 1 lan doi soat ra Excel - cung mau voi usedVoucherReportService.js#buildExcelBuffer
 * (sanitize chong Excel-injection cho cac cot van ban tu do). */
async function buildExcelBuffer(run) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Doi soat cheo Core');

  sheet.columns = [
    { header: 'Mã voucher', key: 'voucherCode', width: 18 },
    { header: 'Mã giao dịch', key: 'transNum', width: 22 },
    { header: 'Công ty', key: 'companyName', width: 28 },
    { header: 'Điểm tiêu', key: 'pointName', width: 26 },
    { header: 'Người thu hồi', key: 'redeemedByUserName', width: 20 },
    { header: 'Thời gian thu hồi (hệ thống)', key: 'redeemedDate', width: 22 },
    { header: 'Trạng thái trên Core', key: 'coreStatusLabel', width: 22 },
    { header: 'Kết quả đối soát', key: 'matchLabel', width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };

  run.results.forEach((row) => {
    sheet.addRow({
      voucherCode: sanitizeExcelText(row.voucherCode),
      transNum: sanitizeExcelText(row.transNum || '-'),
      companyName: sanitizeExcelText(row.companyName || '-'),
      pointName: sanitizeExcelText(row.pointName || '-'),
      redeemedByUserName: sanitizeExcelText(row.redeemedByUserName || '-'),
      redeemedDate: row.redeemedDate || null,
      coreStatusLabel: CORE_STATUS_LABELS[row.coreStatus] || sanitizeExcelText(row.coreMessage || row.coreStatus || '-'),
      matchLabel: row.matchResult === 'MATCH' ? 'KHỚP' : 'CHƯA KHỚP',
    });
  });

  sheet.getColumn('redeemedDate').numFmt = 'dd/mm/yyyy hh:mm';
  return workbook.xlsx.writeBuffer();
}

module.exports = {
  MAX_VOUCHERS_PER_RUN,
  estimateCount,
  startRun,
  listRuns,
  getRun,
  buildExcelBuffer,
  runReconciliationForSchedule,
  sendRunEmail,
};
