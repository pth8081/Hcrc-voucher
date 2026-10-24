const ExcelJS = require('exceljs');
const { sql, getPool } = require('../config/db');

// Gioi han so dong toi da khi XUAT Excel - rong hon GIOI HAN HIEN THI mac dinh tren man hinh
// (1000, xem `list()`), cung quy uoc MAX_EXPORT_ROWS da dung o reportService.js.
const MAX_EXPORT_ROWS = 50000;

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

// L1 (xem giai thich day du o usedVoucherReportService.js): them dau nhay don o dau chuoi NEU
// bat dau bang =/+/-/@ de ep hien thi nhu van ban thuan tuy, tranh cong thuc gia mao.
const FORMULA_PREFIX_REGEX = /^[=+\-@\t\r]/;
function sanitizeExcelText(value) {
  if (value === null || value === undefined) return value;
  const str = String(value);
  return FORMULA_PREFIX_REGEX.test(str) ? `'${str}` : str;
}

async function buildExcelBuffer(rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Hoat dong quet-thu hoi');
  sheet.columns = [
    { header: 'Thoi gian', key: 'createdDate', width: 20 },
    { header: 'Nguoi quet', key: 'userName', width: 20 },
    { header: 'Dia diem', key: 'locationsDetail', width: 16 },
    { header: 'Ma voucher', key: 'voucherCode', width: 18 },
    { header: 'Cach quet', key: 'scanMethod', width: 14 },
    { header: 'Hanh dong', key: 'action', width: 12 },
    { header: 'Ket qua', key: 'resultStatus', width: 14 },
    { header: 'Menh gia', key: 'valueAmt', width: 14 },
    { header: 'Ma HTTP Core', key: 'httpStatus', width: 12 },
    { header: 'Thong bao Core', key: 'coreMessage', width: 40 },
    { header: 'Dia chi IP', key: 'clientIp', width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => {
    sheet.addRow({
      createdDate: row.CreatedDate ? new Date(row.CreatedDate) : null,
      userName: sanitizeExcelText(row.UserName),
      locationsDetail: sanitizeExcelText(row.LocationsDetail),
      voucherCode: sanitizeExcelText(row.VoucherCode),
      scanMethod: sanitizeExcelText(row.ScanMethod),
      action: sanitizeExcelText(row.Action),
      resultStatus: sanitizeExcelText(row.ResultStatus),
      valueAmt: row.ValueAmt != null ? Number(row.ValueAmt) : null,
      httpStatus: row.CoreApiHttpStatus,
      coreMessage: sanitizeExcelText(row.CoreApiMessage),
      clientIp: sanitizeExcelText(row.ClientIp),
    });
  });
  sheet.getColumn('createdDate').numFmt = 'dd/mm/yyyy hh:mm:ss';
  sheet.getColumn('valueAmt').numFmt = '#,##0';
  return workbook.xlsx.writeBuffer();
}

module.exports = { list, buildExcelBuffer, MAX_EXPORT_ROWS };
