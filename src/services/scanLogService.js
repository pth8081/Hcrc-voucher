const { sql, getPool } = require('../config/db');

/**
 * Doc lai VoucherScanLogs (ghi MOI lan quet/kiem tra/thu hoi, ca thanh cong lan that bai -
 * xem sql/002) de phuc vu man hinh "Nhat ky he thong" cho admin. Chi doc, khong ghi (ghi da
 * co san trong voucherService.js).
 */
async function list({ fromDate, toDate, limit }) {
  const pool = await getPool();
  // Dot ra soat sau phat hien: truoc day chi gioi han CAN TREN (Math.min) - 1 gia tri am (vd
  // ?limit=-1) van la "truthy" nen vuot qua "|| 300", roi lam SELECT TOP (@limit) bao loi SQL
  // (TOP khong chap nhan gia tri am). Ep ve khoang [1, 1000] ro rang thay vi chi chan tren.
  const safeLimit = Math.min(Math.max(Number(limit) || 300, 1), 1000);
  const request = pool.request().input('limit', sql.Int, safeLimit);

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
