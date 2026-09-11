const { sql, getPool } = require('../config/db');
const coreVoucherService = require('./coreVoucherService');
const systemLogService = require('./systemLogService');
const { SYNC_PROC_NAME } = require('../utils/syncConstants');

const { VOUCHER_STATUS } = coreVoucherService;

const MAX_ATTEMPTS = Number(process.env.SYNC_RETRY_MAX_ATTEMPTS || 20);
const BATCH_SIZE = Number(process.env.SYNC_RETRY_BATCH_SIZE || 20);

/**
 * Lay 1 lot ban ghi dang cho dong bo, LOAI TRU ngay trong cau truy van cac ban ghi da vuot
 * qua so lan thu toi da (MAX_ATTEMPTS) - neu khong loai, cac ban ghi "chet" nay (vd voucher
 * da het han, khong bao gio dong bo duoc) se chiem het @batchSize moi lan chay mai mai (vi
 * luon dung dau danh sach theo Created_Date ASC), khien cac ban ghi moi hon phia sau khong
 * bao gio duoc thu, dan den bao cao thieu du lieu that.
 */
async function fetchPendingBatch() {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('batchSize', sql.Int, BATCH_SIZE)
    .input('proName', sql.NVarChar(300), SYNC_PROC_NAME)
    .input('maxAttempts', sql.Int, MAX_ATTEMPTS)
    .query(`
      SELECT TOP (@batchSize) v.Id, v.TRANS_NUM, v.Voucher_Code, v.User_Name,
             v.Locations_Group, v.Locations_Detail, v.Created_Date
      FROM dbo.VOUCHER_SYNC v
      WHERE v.Sync = 'N'
        AND (
          SELECT COUNT(*) FROM dbo.Voucher_Exelogs e
          WHERE e.pro_name = @proName AND e.p_key = v.TRANS_NUM AND e.p_tatus = 'FAILED'
        ) < @maxAttempts
      ORDER BY v.Created_Date ASC
    `);
  return result.recordset;
}

async function markSynced(id) {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.BigInt, id)
    .query(`UPDATE dbo.VOUCHER_SYNC SET Sync = 'Y', Sync_update = 'Y', Last_update = GETDATE() WHERE Id = @id`);
}

/**
 * Chay 1 lot dong bo lai cac ban ghi VOUCHER_SYNC dang o "hang doi" (Sync = 'N') -
 * tao ra khi truoc do thu hoi thanh cong tai cho nhung KHONG goi duoc Core API de
 * bao tieu (mat mang/Core bao tri...). Goi lai request thu hoi cho tung ban ghi:
 *
 * - Core xac nhan thanh cong (hoac da o trang thai USED - rat co the chinh la do
 *   request lan truoc cua chung ta da toi noi nhung bi mat ket noi truoc khi nhan
 *   duoc phan hoi) -> coi nhu DA DONG BO, Sync='Y', ra khoi hang doi.
 * - Core tu choi vi ly do khac (EXPIRED/CANCELLED/NOT_FOUND/loi that su) -> giu
 *   Sync='N' de thu lai lan sau, tru khi da vuot qua SYNC_RETRY_MAX_ATTEMPTS thi
 *   bo qua (van giu 'N' de con nguoi ra soat thu cong, khong am tham mat du lieu).
 *
 * Moi lan thu (thanh cong hay that bai) deu duoc ghi vao Voucher_Exelogs (log he thong).
 */
async function processPendingSyncs() {
  const batch = await fetchPendingBatch();
  if (!batch.length) return { processed: 0, synced: 0, failed: 0, skipped: 0 };

  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of batch) {
    const pKey = row.TRANS_NUM;
    // eslint-disable-next-line no-await-in-loop
    const attempts = await systemLogService.countFailedAttempts({ proName: SYNC_PROC_NAME, pKey });
    if (attempts >= MAX_ATTEMPTS) {
      skipped += 1;
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await coreVoucherService.redeemVoucher(row.Voucher_Code, {
        username: row.User_Name,
        locationsGroup: row.Locations_Group,
        locationsDetail: row.Locations_Detail,
        transNum: row.TRANS_NUM,
      });

      const alreadyReflected = !result.success && result.status === VOUCHER_STATUS.USED;

      // C2: khi Core bao USED, TRUOC DAY luon coi la "chinh request cua minh, chi la phan hoi
      // bi mat" - nhung co the la 1 vu trung thu hoi THAT (voucher bi tieu qua kenh khac trong
      // luc app nay mat ket noi Core). Doi chieu thoi diem Core noi da tieu (redeemedAt, neu
      // mapping co cau hinh) voi thoi diem CHINH app nay ghi nhan cuc bo (Created_Date): neu
      // Core noi da tieu TRUOC ca luc app nay moi ghi nhan (co du bu sai lech dong ho), chac
      // chan KHONG PHAI la phan hoi cua chinh request nay - danh dau CONFLICT de admin doi
      // soat thu cong, khong am tham dong ho so.
      // Chi doi chieu khi redeemedAt la gia tri THAT do Core tra ve (redeemedAtIsEstimated=false) -
      // coreVoucherService.js gia lap "now" lam redeemedAt khi Core khong co/khong map truong nay,
      // gia tri gia lap do LUON lon hon localCreatedAt (vi la thoi diem HIEN TAI, sau ca luc ghi
      // nhan cuc bo) nen se khien dieu kien ben duoi KHONG BAO GIO dung - vo hieu hoa am tham toan
      // bo co che phat hien xung dot nay neu khong loai tru (da bi 1 dot ra soat sau phat hien).
      let conflict = false;
      if (alreadyReflected && result.redeemedAt && !result.redeemedAtIsEstimated) {
        const coreRedeemedAt = new Date(result.redeemedAt);
        const localCreatedAt = new Date(row.Created_Date);
        // Core la he thong legacy chay tren ha tang noi bo, khong dam bao dong bo NTP chat che nhu
        // ha tang cloud hien dai - nguong 60s ban dau qua chat, de xay ra bao dong gia (XUNG DOT)
        // chi vi lech dong ho giua 2 may that su, khong phai trung thu hoi that. Noi rong len 5 phut.
        const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;
        if (!Number.isNaN(coreRedeemedAt.getTime()) && coreRedeemedAt.getTime() < localCreatedAt.getTime() - CLOCK_SKEW_TOLERANCE_MS) {
          conflict = true;
        }
      }

      if (conflict) {
        // Log voi status='FAILED' (khong phai 1 gia tri moi) de van duoc tinh vao
        // countFailedAttempts/MAX_ATTEMPTS nhu cac ban ghi loi khac - tranh 1 xung dot chua xu
        // ly bi thu lai vo han moi lan chay job (chiem cho dau hang doi mai mai). Tien to
        // "XUNG DOT" trong message de admin phan biet duoc voi loi ket noi thong thuong khi
        // xem lai Voucher_Exelogs.
        // eslint-disable-next-line no-await-in-loop
        await systemLogService.logExecution({
          proName: SYNC_PROC_NAME,
          pKey,
          uniqueIdGroup: row.Voucher_Code,
          status: 'FAILED',
          message: `XUNG DOT (CONFLICT): Core bao voucher da USED tu ${result.redeemedAt} - TRUOC ca thoi diem app nay ghi nhan cuc bo (${row.Created_Date}), co the la 1 vu trung thu hoi THAT qua kenh khac. GIU Sync='N', CAN QUAN TRI VIEN DOI SOAT THU CONG, khong tu dong danh dau da dong bo.`,
          syncRecord: 0,
        });
        failed += 1;
      } else if (result.success || alreadyReflected) {
        // eslint-disable-next-line no-await-in-loop
        await markSynced(row.Id);
        // eslint-disable-next-line no-await-in-loop
        await systemLogService.logExecution({
          proName: SYNC_PROC_NAME,
          pKey,
          uniqueIdGroup: row.Voucher_Code,
          status: 'SUCCESS',
          message: alreadyReflected
            ? `Core da o trang thai USED${result.redeemedAt ? ` (redeemedAt=${result.redeemedAt})` : ' (Core khong tra ve thoi diem tieu de doi chieu)'} - da so sanh thoi diem, phu hop voi gia thiet chinh request lan truoc bi mat phan hoi - coi nhu da dong bo`
            : 'Da dong bo lai thanh cong voi Core API',
          syncRecord: 1,
        });
        synced += 1;
      } else {
        // eslint-disable-next-line no-await-in-loop
        await systemLogService.logExecution({
          proName: SYNC_PROC_NAME,
          pKey,
          uniqueIdGroup: row.Voucher_Code,
          status: 'FAILED',
          message: `Core tu choi dong bo: ${result.message || result.status}`,
          syncRecord: 0,
        });
        failed += 1;
      }
    } catch (err) {
      // eslint-disable-next-line no-await-in-loop
      await systemLogService.logExecution({
        proName: SYNC_PROC_NAME,
        pKey,
        uniqueIdGroup: row.Voucher_Code,
        status: 'FAILED',
        message: `Khong ket noi duoc Core API: ${err.message}`,
        syncRecord: 0,
      });
      failed += 1;
    }
  }

  return { processed: batch.length, synced, failed, skipped };
}

module.exports = { processPendingSyncs };
