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
             v.Locations_Group, v.Locations_Detail
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

      if (result.success || alreadyReflected) {
        // eslint-disable-next-line no-await-in-loop
        await markSynced(row.Id);
        // eslint-disable-next-line no-await-in-loop
        await systemLogService.logExecution({
          proName: SYNC_PROC_NAME,
          pKey,
          uniqueIdGroup: row.Voucher_Code,
          status: 'SUCCESS',
          message: alreadyReflected
            ? 'Core da o trang thai USED (co the tu chinh request lan truoc bi mat phan hoi) - coi nhu da dong bo'
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
