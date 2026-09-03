const { sql, getPool } = require('../config/db');

/**
 * Ghi log HE THONG (khac voi VoucherScanLogs la log THAO TAC NGUOI DUNG) vao bang
 * Voucher_Exelogs co san trong schema goc - dung dung dung y ban dau cua bang nay:
 * theo doi cac lan chay tien trinh dong bo/tich hop voi he thong trung tam.
 */
async function logExecution({ proName, pKey, uniqueIdGroup, status, message, detail, syncRecord }) {
  const pool = await getPool();
  await pool
    .request()
    .input('messenger', sql.NVarChar(1000), message || null)
    .input('pTatus', sql.NVarChar(20), status)
    .input('pKey', sql.NVarChar(60), pKey || null)
    .input('proName', sql.NVarChar(300), proName)
    .input('uniqueIdGroup', sql.NVarChar(100), uniqueIdGroup || null)
    .input('syncRecord', sql.Int, syncRecord === undefined || syncRecord === null ? null : syncRecord)
    .input('iDesc', sql.NVarChar(sql.MAX), detail || null)
    .query(`
      INSERT INTO dbo.Voucher_Exelogs
        (Messenger, p_tatus, p_key, pro_name, UniqueID_Group, createdate, Sync_Record, iDesc)
      VALUES
        (@messenger, @pTatus, @pKey, @proName, @uniqueIdGroup, GETDATE(), @syncRecord, @iDesc)
    `);
}

/**
 * Dem tong so lan dong bo THAT BAI da ghi nhan cho 1 p_key, dung de gioi han so lan
 * retry (Voucher_Exelogs.createdate chi co do phan giai theo NGAY trong schema goc,
 * nen dem theo tong so lan thay vi theo khung gio de tranh sai lech).
 */
async function countFailedAttempts({ proName, pKey }) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('proName', sql.NVarChar(300), proName)
    .input('pKey', sql.NVarChar(60), pKey)
    .query(`
      SELECT COUNT(*) AS Attempts
      FROM dbo.Voucher_Exelogs
      WHERE pro_name = @proName AND p_key = @pKey AND p_tatus = 'FAILED'
    `);
  return result.recordset[0]?.Attempts || 0;
}

module.exports = { logExecution, countFailedAttempts };
