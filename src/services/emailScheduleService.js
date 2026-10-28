const { sql, getPool } = require('../config/db');
const authService = require('./authService');
const reportAccessService = require('./reportAccessService');
const userVoucherSystemService = require('./userVoucherSystemService');
const reportService = require('./reportService');
const summaryReportService = require('./summaryReportService');
const usedVoucherReportService = require('./usedVoucherReportService');
const emailGatewayService = require('./emailGatewayService');

const REPORT_TYPES = ['DAILY', 'SUMMARY', 'USED_VOUCHERS'];
const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'];
const DATE_RANGE_MODES = [
  'YESTERDAY', 'TODAY', 'LAST_7_DAYS', 'LAST_30_DAYS', 'THIS_MONTH', 'LAST_MONTH',
  'THIS_YEAR', 'LAST_YEAR', 'CUSTOM',
];
const DATE_STR_RE = /^\d{4}-\d{2}-\d{2}$/;

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

/** Cot ConnectionIds luu dang chuoi "1,5,9" (hoac rong/NULL = khong gioi han them) - tach thanh
 * mang so nguyen, dung chung cho rowToDto() va resolveScheduleScope(). */
function parseConnectionIdsColumn(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n));
}

function rowToDto(row) {
  return {
    id: row.Id,
    name: row.Name,
    reportType: row.ReportType,
    dateRangeMode: row.DateRangeMode,
    companyId: row.CompanyId,
    redemptionUnitId: row.RedemptionUnitId,
    connectionIds: parseConnectionIdsColumn(row.ConnectionIds),
    customFromDate: row.CustomFromDate ? toDateStr(new Date(row.CustomFromDate)) : null,
    customToDate: row.CustomToDate ? toDateStr(new Date(row.CustomToDate)) : null,
    recipients: row.Recipients,
    frequency: row.Frequency,
    sendHour: row.SendHour,
    sendMinute: row.SendMinute,
    weekDay: row.WeekDay,
    monthDay: row.MonthDay,
    isEnabled: !!row.IsEnabled,
    createdByUserId: row.CreatedByUserId,
    createdByUsername: row.CreatedByUsername,
    createdDate: row.CreatedDate,
    // v3.89: LastSentDate duoc markSent() ghi bang nowVn() (gio VN "dang qua UTC-getters" -
    // xem ghi chu o isDueNow()), nen khi doc lai qua driver mssql/tedious (useUTC:true mac dinh)
    // UTC-getters cua gia tri doc duoc VAN DUNG LA gio VN that - nhung JSON gui ve FE lai mang
    // nhan "Z" (UTC) sai, khien fmtDate() o email-schedules.js cong nham +7h luc hien ra man
    // hinh. CHI sua O DAY (tang hien thi) - KHONG dong vao cot DB/isDueNow() ben tren, vi logic
    // chong gui trung dang so sanh dung nhau (ca 2 cung dang quy uoc "gio VN qua UTC-getters"),
    // sua o do se lam lech lai dung loi da tung kiem thu phat hien truoc do (xem ghi chu isDueNow()).
    lastSentDate: row.LastSentDate ? new Date(row.LastSentDate.getTime() - 7 * 60 * 60 * 1000) : null,
    lastSentStatus: row.LastSentStatus,
    lastSentMessage: row.LastSentMessage,
  };
}

/** Admin (role=1) thay TOAN BO lich; tai khoan khac (ke ca "Quan tri doi tac") CHI thay lich DO
 * CHINH MINH tao - dung quy uoc giong het partnerAdminService.js (moi nguoi chi quan ly pham vi
 * cua rieng minh). */
async function listSchedules({ userId, role }) {
  const pool = await getPool();
  const isAdmin = Number(role) === 1;
  const request = pool.request();
  let filter = '';
  if (!isAdmin) {
    request.input('userId', sql.Int, userId);
    filter = 'WHERE CreatedByUserId = @userId';
  }
  const result = await request.query(`
    SELECT * FROM dbo.EmailReportSchedules ${filter} ORDER BY Name
  `);
  return result.recordset.map(rowToDto);
}

async function getScheduleRow(id) {
  const pool = await getPool();
  const result = await pool.request().input('id', sql.Int, id).query('SELECT * FROM dbo.EmailReportSchedules WHERE Id = @id');
  return result.recordset[0] || null;
}

/** Nem loi 404/403 neu lich khong ton tai hoac khong thuoc quyen cua user nay (admin luon qua). */
async function assertOwnership(id, { userId, role }) {
  const row = await getScheduleRow(id);
  if (!row) {
    const err = new Error('Khong tim thay lich gui nay');
    err.statusCode = 404;
    err.publicMessage = err.message;
    throw err;
  }
  if (Number(role) !== 1 && row.CreatedByUserId !== userId) {
    throw forbidden('Ban khong co quyen thao tac tren lich gui nay');
  }
  return row;
}

function parseRecipients(raw) {
  const list = String(raw || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const invalid = list.filter((e) => !EMAIL_RE.test(e));
  if (invalid.length) throw badRequest(`Email khong hop le: ${invalid.join(', ')}`);
  if (!list.length) throw badRequest('Can it nhat 1 email nguoi nhan');
  return Array.from(new Set(list)).join(', ');
}

function validateInput(data) {
  const name = String(data.name || '').trim();
  if (!name) throw badRequest('Thieu ten lich');
  if (!REPORT_TYPES.includes(data.reportType)) throw badRequest('Loai bao cao khong hop le');
  if (!DATE_RANGE_MODES.includes(data.dateRangeMode)) throw badRequest('Khoang ngay bao cao khong hop le');
  if (!FREQUENCIES.includes(data.frequency)) throw badRequest('Tan suat khong hop le');
  const sendHour = Number(data.sendHour);
  const sendMinute = Number(data.sendMinute);
  if (!Number.isInteger(sendHour) || sendHour < 0 || sendHour > 23) throw badRequest('Gio gui khong hop le');
  if (!Number.isInteger(sendMinute) || sendMinute < 0 || sendMinute > 59) throw badRequest('Phut gui khong hop le');
  let weekDay = null;
  let monthDay = null;
  if (data.frequency === 'WEEKLY') {
    weekDay = Number(data.weekDay);
    if (!Number.isInteger(weekDay) || weekDay < 0 || weekDay > 6) throw badRequest('Thu trong tuan khong hop le');
  }
  if (data.frequency === 'MONTHLY') {
    monthDay = Number(data.monthDay);
    if (!Number.isInteger(monthDay) || monthDay < 1 || monthDay > 31) throw badRequest('Ngay trong thang khong hop le');
  }

  // "He thong" la lua chon RO RANG (checkbox nhieu he thong) - KHONG con mac dinh "tat ca/full"
  // ngoai y muon nhu truoc. Mang rong = van cho phep (se bi loc lai theo quyen thuc te luc gui,
  // xem resolveScheduleScope()) nhung KHONG tu dong suy ra "tat ca" - frontend luon gui du danh
  // sach he thong nguoi dung CHON (co the la toan bo danh sach ho duoc xem, nhung la lua chon
  // tuong minh, khong phai gia tri rong ngam dinh).
  const connectionIdsRaw = Array.isArray(data.connectionIds) ? data.connectionIds : [];
  const connectionIds = connectionIdsRaw.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0);
  if (!connectionIds.length) throw badRequest('Can chon it nhat 1 he thong voucher de gui bao cao');

  let customFromDate = null;
  let customToDate = null;
  if (data.dateRangeMode === 'CUSTOM') {
    customFromDate = String(data.customFromDate || '').trim();
    customToDate = String(data.customToDate || '').trim();
    if (!DATE_STR_RE.test(customFromDate) || !DATE_STR_RE.test(customToDate)) {
      throw badRequest('Khoang ngay tuy chon khong hop le');
    }
    if (customFromDate > customToDate) throw badRequest('"Tu ngay" phai truoc hoac bang "Den ngay"');
  }

  return {
    name,
    reportType: data.reportType,
    dateRangeMode: data.dateRangeMode,
    customFromDate,
    customToDate,
    companyId: data.companyId ? Number(data.companyId) : null,
    redemptionUnitId: data.redemptionUnitId ? Number(data.redemptionUnitId) : null,
    connectionIds,
    recipients: parseRecipients(data.recipients),
    frequency: data.frequency,
    sendHour,
    sendMinute,
    weekDay,
    monthDay,
  };
}

async function createSchedule(data, user) {
  const v = validateInput(data);
  const pool = await getPool();
  const result = await pool
    .request()
    .input('name', sql.NVarChar(200), v.name)
    .input('reportType', sql.NVarChar(20), v.reportType)
    .input('dateRangeMode', sql.NVarChar(20), v.dateRangeMode)
    .input('customFromDate', sql.Date, v.customFromDate)
    .input('customToDate', sql.Date, v.customToDate)
    .input('companyId', sql.Int, v.companyId)
    .input('redemptionUnitId', sql.Int, v.redemptionUnitId)
    .input('connectionIds', sql.NVarChar(200), v.connectionIds.join(','))
    .input('recipients', sql.NVarChar(1000), v.recipients)
    .input('frequency', sql.NVarChar(20), v.frequency)
    .input('sendHour', sql.TinyInt, v.sendHour)
    .input('sendMinute', sql.TinyInt, v.sendMinute)
    .input('weekDay', sql.TinyInt, v.weekDay)
    .input('monthDay', sql.TinyInt, v.monthDay)
    .input('createdByUserId', sql.Int, user.userId)
    .input('createdByUsername', sql.NVarChar(100), user.username)
    .query(`
      INSERT INTO dbo.EmailReportSchedules
        (Name, ReportType, DateRangeMode, CustomFromDate, CustomToDate, CompanyId, RedemptionUnitId, ConnectionIds, Recipients,
         Frequency, SendHour, SendMinute, WeekDay, MonthDay, IsEnabled, CreatedByUserId, CreatedByUsername, CreatedDate)
      OUTPUT INSERTED.Id
      VALUES
        (@name, @reportType, @dateRangeMode, @customFromDate, @customToDate, @companyId, @redemptionUnitId, @connectionIds, @recipients,
         @frequency, @sendHour, @sendMinute, @weekDay, @monthDay, 1, @createdByUserId, @createdByUsername, GETDATE())
    `);
  return { id: result.recordset[0].Id };
}

async function updateSchedule(id, data, user) {
  await assertOwnership(id, user);
  const v = validateInput(data);
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('name', sql.NVarChar(200), v.name)
    .input('reportType', sql.NVarChar(20), v.reportType)
    .input('dateRangeMode', sql.NVarChar(20), v.dateRangeMode)
    .input('customFromDate', sql.Date, v.customFromDate)
    .input('customToDate', sql.Date, v.customToDate)
    .input('companyId', sql.Int, v.companyId)
    .input('redemptionUnitId', sql.Int, v.redemptionUnitId)
    .input('connectionIds', sql.NVarChar(200), v.connectionIds.join(','))
    .input('recipients', sql.NVarChar(1000), v.recipients)
    .input('frequency', sql.NVarChar(20), v.frequency)
    .input('sendHour', sql.TinyInt, v.sendHour)
    .input('sendMinute', sql.TinyInt, v.sendMinute)
    .input('weekDay', sql.TinyInt, v.weekDay)
    .input('monthDay', sql.TinyInt, v.monthDay)
    .query(`
      UPDATE dbo.EmailReportSchedules SET
        Name = @name, ReportType = @reportType, DateRangeMode = @dateRangeMode,
        CustomFromDate = @customFromDate, CustomToDate = @customToDate,
        CompanyId = @companyId, RedemptionUnitId = @redemptionUnitId, ConnectionIds = @connectionIds,
        Recipients = @recipients, Frequency = @frequency, SendHour = @sendHour, SendMinute = @sendMinute,
        WeekDay = @weekDay, MonthDay = @monthDay, UpdatedDate = GETDATE()
      WHERE Id = @id
    `);
}

async function setEnabled(id, isEnabled, user) {
  await assertOwnership(id, user);
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('isEnabled', sql.Bit, isEnabled ? 1 : 0)
    .query('UPDATE dbo.EmailReportSchedules SET IsEnabled = @isEnabled, UpdatedDate = GETDATE() WHERE Id = @id');
}

async function removeSchedule(id, user) {
  await assertOwnership(id, user);
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.EmailReportSchedules WHERE Id = @id');
}

// Mui gio Viet Nam (+7, khong co gio mua he) - dung quy uoc giong het voucherService.js#VN_OFFSET_MS,
// de "hom nay"/"gio hien tai" doc lap voi mui gio thuc te cua may chu dang chay Node.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
function nowVn() {
  return new Date(Date.now() + VN_OFFSET_MS);
}
function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

/** Tinh khoang ngay (fromDate/toDate, dang "YYYY-MM-DD") theo DateRangeMode - tinh theo "hom nay"
 * gio Viet Nam, doc lap mui gio may chu. Voi mode 'CUSTOM', lay nguyen CustomFromDate/CustomToDate
 * da luu tren lich (customFromDate/customToDate - co the la string "YYYY-MM-DD" hoac Date tu CSDL). */
function resolveDateRange(dateRangeMode, customFromDate, customToDate) {
  const now = nowVn();
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dayMs = 24 * 60 * 60 * 1000;
  const atOffset = (days) => toDateStr(new Date(todayMs + days * dayMs));

  switch (dateRangeMode) {
    case 'TODAY':
      return { fromDate: atOffset(0), toDate: atOffset(0) };
    case 'YESTERDAY':
      return { fromDate: atOffset(-1), toDate: atOffset(-1) };
    case 'LAST_7_DAYS':
      return { fromDate: atOffset(-6), toDate: atOffset(0) };
    case 'LAST_30_DAYS':
      return { fromDate: atOffset(-29), toDate: atOffset(0) };
    case 'THIS_MONTH': {
      const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { fromDate: toDateStr(first), toDate: atOffset(0) };
    }
    case 'LAST_MONTH': {
      const firstThis = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const lastPrev = new Date(firstThis.getTime() - dayMs);
      const firstPrev = new Date(Date.UTC(lastPrev.getUTCFullYear(), lastPrev.getUTCMonth(), 1));
      return { fromDate: toDateStr(firstPrev), toDate: toDateStr(lastPrev) };
    }
    case 'THIS_YEAR': {
      const first = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      return { fromDate: toDateStr(first), toDate: atOffset(0) };
    }
    case 'LAST_YEAR': {
      const firstPrev = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
      const lastPrev = new Date(Date.UTC(now.getUTCFullYear() - 1, 11, 31));
      return { fromDate: toDateStr(firstPrev), toDate: toDateStr(lastPrev) };
    }
    case 'CUSTOM': {
      const from = customFromDate instanceof Date ? toDateStr(customFromDate) : String(customFromDate || '').slice(0, 10);
      const to = customToDate instanceof Date ? toDateStr(customToDate) : String(customToDate || '').slice(0, 10);
      return { fromDate: from || atOffset(0), toDate: to || atOffset(0) };
    }
    default:
      return { fromDate: atOffset(0), toDate: atOffset(0) };
  }
}

/**
 * Tinh PHAM VI DU LIEU that su cho 1 lich, dua tren quyen HIEN TAI (doc tuoi tu CSDL, khong tin
 * bat ky gia tri nao da luu san o lich) cua chinh tai khoan da tao lich (CreatedByUserId) - dung
 * LAI y het logic report.controller.js#resolveScope/resolveConnectionFilter dung cho man hinh
 * bao cao binh thuong, dam bao 1 lich CHI BAO GIO gui dung du lieu ma nguoi tao duoc phep xem TAI
 * THOI DIEM gui (khong phai tai thoi diem tao lich) - tu dong "thu hep" lai neu quyen bi thu hoi
 * sau do, khong can dong bo thu cong.
 */
async function resolveScheduleScope(schedule) {
  const owner = await authService.findUserById(schedule.CreatedByUserId);
  if (!owner) {
    throw badRequest('Tai khoan tao lich nay khong con ton tai');
  }
  const { codes: visibleLocationCodes } = await reportAccessService.resolveVisibleLocationCodes({
    userId: owner.UserID,
    ownLocationsDetail: owner.Locations_Detail,
    role: owner.status,
  });

  const allowed = await userVoucherSystemService.getAllowedConnectionIds(owner.UserID);
  const selected = parseConnectionIdsColumn(schedule.ConnectionIds);
  let connectionIds;
  let includeUntaggedConnections;
  if (selected.length) {
    // Nguoi tao lich da CHON TUONG MINH 1 hay nhieu he thong (checkbox) - GIAO (intersect) voi
    // quyen THUC TE hien tai cua ho, giong het cach report.controller.js#resolveConnectionFilter
    // xu ly tham so connectionId tu query string (khong tin du lieu da luu tren lich, doi chieu
    // lai voi quyen hien tai moi lan gui - quyen bi thu hoi sau khi tao lich se tu dong thu hep).
    connectionIds = allowed === null ? selected : selected.filter((id) => allowed.includes(id));
    includeUntaggedConnections = false;
  } else if (allowed === null) {
    connectionIds = null;
    includeUntaggedConnections = false;
  } else {
    includeUntaggedConnections = allowed.includes(userVoucherSystemService.UNTAGGED_CONNECTION_ID);
    connectionIds = allowed.filter((id) => id !== userVoucherSystemService.UNTAGGED_CONNECTION_ID);
  }

  return { visibleLocationCodes, connectionIds, includeUntaggedConnections };
}

/** Sinh noi dung bao cao (du lieu + file Excel dinh kem) cho 1 lich, DUNG LAI cac service bao cao
 * da co san (giong het luong man hinh "Xuat Excel" dang dung) - dam bao cung 1 cach tinh toan,
 * khong trung lap logic truy van. */
async function buildReportAttachment(schedule, scope) {
  const { fromDate, toDate } = resolveDateRange(schedule.DateRangeMode, schedule.CustomFromDate, schedule.CustomToDate);
  const extra = {
    visibleLocationCodes: scope.visibleLocationCodes,
    companyId: schedule.CompanyId,
    redemptionUnitId: schedule.RedemptionUnitId,
    connectionIds: scope.connectionIds,
    includeUntaggedConnections: scope.includeUntaggedConnections,
  };

  if (schedule.ReportType === 'DAILY') {
    const { summary, details } = await reportService.dailyReconciliation({
      fromDate, toDate, ...extra, maxDetailRows: reportService.MAX_EXPORT_ROWS,
    });
    const buffer = await reportService.buildReconciliationExcelBuffer({ summary, details });
    return { fromDate, toDate, buffer, fileName: `bao-cao-doi-soat_${fromDate}_${toDate}.xlsx`, rowCount: details.length };
  }
  if (schedule.ReportType === 'SUMMARY') {
    const data = await summaryReportService.consolidatedReport({
      fromDate, toDate, ...extra, maxRows: summaryReportService.MAX_EXPORT_ROWS,
    });
    const buffer = await summaryReportService.buildSummaryExcelBuffer(data);
    return { fromDate, toDate, buffer, fileName: `bao-cao-tong-hop_${fromDate}_${toDate}.xlsx`, rowCount: data.grandTotal ? data.grandTotal.voucherCount : 0 };
  }
  // USED_VOUCHERS
  const rows = await usedVoucherReportService.listUsedVouchers({
    fromDate, toDate, ...extra, maxRows: usedVoucherReportService.MAX_EXPORT_ROWS,
  });
  const buffer = await usedVoucherReportService.buildExcelBuffer(rows);
  return { fromDate, toDate, buffer, fileName: `voucher-da-su-dung_${fromDate}_${toDate}.xlsx`, rowCount: rows.length };
}

const REPORT_TYPE_LABEL = { DAILY: 'Báo cáo đối soát', SUMMARY: 'Báo cáo tổng hợp', USED_VOUCHERS: 'Danh sách voucher đã sử dụng' };

/**
 * Ghi LastSentDate bang nowVn() (tinh trong JS) THAY VI GETDATE() (dong ho may chu SQL Server) -
 * tranh phu thuoc dong ho may chu DB co the lech voi cach isDueNow() tinh "hom nay" o duoi (cung
 * nguyen tac voi PasswordVersion thay vi so sanh "iat" JWT trong authService.js). Vi mssql mac
 * dinh doc/ghi DATETIME theo GIA TRI UTC-getters cua Date object (khong tu quy doi them), gia tri
 * nowVn() (von da "gia lap" gio VN qua cac UTC-getters) duoc luu VA doc lai NGUYEN VEN, khop
 * chinh xac voi cach isDueNow() so sanh (khong can cong lech lan 2 - xem ghi chu o do).
 */
async function markSent(id, status, message) {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('sentDate', sql.DateTime, nowVn())
    .input('status', sql.NVarChar(20), status)
    .input('message', sql.NVarChar(1000), message ? String(message).slice(0, 1000) : null)
    .query('UPDATE dbo.EmailReportSchedules SET LastSentDate = @sentDate, LastSentStatus = @status, LastSentMessage = @message WHERE Id = @id');
}

/** Gui 1 lich NGAY LAP TUC (dung chung boi "Gui ngay" tren giao dien va job tu dong dinh ky). Nem
 * loi ro rang neu that bai (giao dien/job tu ghi lai LastSentStatus='FAILED' o noi goi). */
async function sendScheduleNow(schedule) {
  const scope = await resolveScheduleScope(schedule);
  const { fromDate, toDate, buffer, fileName, rowCount } = await buildReportAttachment(schedule, scope);
  const label = REPORT_TYPE_LABEL[schedule.ReportType] || schedule.ReportType;
  const subject = `[HCRC Voucher] ${schedule.Name} - ${fromDate === toDate ? fromDate : `${fromDate} đến ${toDate}`}`;
  const html = `
    <p>Xin chào,</p>
    <p>Đây là email tự động từ Hệ thống thu hồi voucher HCRC.</p>
    <p><b>${label}</b> — khoảng thời gian: ${fromDate === toDate ? fromDate : `${fromDate} đến ${toDate}`} (${rowCount} dòng dữ liệu).</p>
    <p>Chi tiết xem trong file Excel đính kèm.</p>
    <p style="color:#888;font-size:12px">Email này được gửi tự động theo lịch "${schedule.Name}" - không cần phản hồi.</p>
  `;
  await emailGatewayService.sendMail({
    to: schedule.Recipients,
    subject,
    html,
    attachments: [{ filename: fileName, content: Buffer.from(buffer) }],
  });
}

/** Lich co DUNG GIO/NGAY voi thoi diem hien tai (gio VN) VA CHUA gui trong hom nay hay khong -
 * dung boi job nen (emailScheduler.js), chay moi phut. So sanh theo NGAY (khong phai gio chinh
 * xac) voi LastSentDate de tranh gui trung neu tien trinh khoi dong lai/tick 2 lan gan nhau trong
 * cung 1 phut - cung cach lam voi dieu kien "chua gui hom nay", khong phai khoa rieng. */
function isDueNow(schedule, now) {
  if (!schedule.IsEnabled) return false;
  if (schedule.SendHour !== now.getUTCHours() || schedule.SendMinute !== now.getUTCMinutes()) return false;
  if (schedule.Frequency === 'WEEKLY' && schedule.WeekDay !== now.getUTCDay()) return false;
  if (schedule.Frequency === 'MONTHLY' && schedule.MonthDay !== now.getUTCDate()) return false;
  // LastSentDate duoc markSent() luu bang nowVn() (khong phai GETDATE()) - da la gia tri "gio VN
  // qua UTC-getters" giong het `now`, nen so sanh THANG, KHONG cong them VN_OFFSET_MS lan nua
  // (cong 2 lan se lam ngay bi lech +7h, dan den so sanh sai - da bi 1 dot kiem thu sau phat hien).
  if (schedule.LastSentDate && toDateStr(schedule.LastSentDate) === toDateStr(now)) return false;
  return true;
}

/** Danh sach lich DEN HAN gui ngay bay gio (goi tu emailScheduler.js). */
async function findDueSchedules() {
  const pool = await getPool();
  const result = await pool.request().query('SELECT * FROM dbo.EmailReportSchedules WHERE IsEnabled = 1');
  const now = nowVn();
  return result.recordset.filter((row) => isDueNow(row, now));
}

module.exports = {
  REPORT_TYPES,
  FREQUENCIES,
  DATE_RANGE_MODES,
  listSchedules,
  getScheduleRow,
  assertOwnership,
  createSchedule,
  updateSchedule,
  setEnabled,
  removeSchedule,
  resolveScheduleScope,
  resolveDateRange,
  sendScheduleNow,
  markSent,
  findDueSchedules,
  isDueNow,
  rowToDto,
};
