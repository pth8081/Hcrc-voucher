const { sql, getPool } = require('../config/db');

/**
 * Doc lai VoucherScanLogs (ghi MOI lan quet/kiem tra/thu hoi, ca thanh cong lan that bai -
 * xem sql/002) de phuc vu man hinh "Nhat ky he thong" cho admin. Chi doc, khong ghi (ghi da
 * co san trong voucherService.js).
 */
async function list({ fromDate, toDate, limit }) {
  const pool = await getPool();
  const request = pool.request().input('limit', sql.Int, Math.min(Number(limit) || 300, 1000));

  let filter = '1 = 1';
  if (fromDate) {
    request.input('fromDate', sql.Date, fromDate);
    filter += ' AND CAST(CreatedDate AS DATE) >= @fromDate';
  }
  if (toDate) {
    request.input('toDate', sql.Date, toDate);
    filter += ' AND CAST(CreatedDate AS DATE) <= @toDate';
  }

  const result = await request.query(`
    SELECT TOP (@limit)
      Id, UserId, UserName, LocationsDetail, VoucherCode, ScanMethod, Action,
      ResultStatus, ValueAmt, CoreApiHttpStatus, CoreApiMessage, ClientIp, CreatedDate
    FROM dbo.VoucherScanLogs
    WHERE ${filter}
    ORDER BY CreatedDate DESC
  `);
  return result.recordset;
}

module.exports = { list };
