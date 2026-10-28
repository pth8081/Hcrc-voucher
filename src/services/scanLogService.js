const ExcelJS = require('exceljs');
const { sql, getPool } = require('../config/db');

// Gioi han so dong toi da khi XUAT Excel - rong hon GIOI HAN HIEN THI mac dinh tren man hinh
// (1000, xem `list()`), cung quy uoc MAX_EXPORT_ROWS da dung o reportService.js.
const MAX_EXPORT_ROWS = 50000;

/**
 * Doc lai VoucherScanLogs (ghi MOI lan quet/kiem tra/thu hoi, ca thanh cong lan that bai -
 * xem sql/002) de phuc vu man hinh "Nhat ky he thong" cho admin. Chi doc, khong ghi (ghi da
 * co san trong voucherService.js).
 *
 * `connectionName` (tuy chon): loc CHI con cac dong co ConnectionName TRUNG KHOP - dung boi
 * partnerAdmin.controller.js de "Quan tri doi tac" (vd Fuji) CHI xem duoc hoat dong quet/thu hoi
 * cua DUNG he thong ho duoc gan (req.partnerAdminConnectionName, xem requirePartnerAdmin.js), KHONG
 * duoc xem cheo sang he thong khac. Man hinh admin day du (adminLog.controller.js) KHONG truyen
 * tham so nay nen khong bi loc gi them, giu dung hanh vi cu.
 */
// VoucherScanLogs.LocationsDetail chi luu MA dia diem (khong phai ten) luc ghi log - JOIN sang
// Locations_Detail de doc ra TEN hien thi thay vi ma. Dung lai dung kieu dedup (1 ma co the trung
// o nhieu dong Locations_Detail cu) nhu LOCATION_MAPPING_JOIN cua reportService.js, uu tien ten
// Diem tieu (RedemptionUnits.PartnerName) hon ten dia diem goc neu co, giong usedVoucherReportService.
const LOCATION_NAME_JOIN = `
  LEFT JOIN (
    SELECT id, LTRIM(RTRIM(LocationCode)) AS LocationCode, LocationName,
      ROW_NUMBER() OVER (
        PARTITION BY LTRIM(RTRIM(LocationCode))
        ORDER BY CASE WHEN EXISTS (SELECT 1 FROM dbo.RedemptionUnits ru0 WHERE ru0.LocationDetailId = d.id) THEN 0 ELSE 1 END, id
      ) AS rn
    FROM dbo.Locations_Detail d
  ) ld ON ld.LocationCode = LTRIM(RTRIM(sl.LocationsDetail)) AND ld.rn = 1
  LEFT JOIN dbo.RedemptionUnits ru ON ru.LocationDetailId = ld.id
`;

async function list({ fromDate, toDate, limit, connectionName }) {
  const pool = await getPool();
  // Dot ra soat sau phat hien: truoc day chi gioi han CAN TREN (Math.min) - 1 gia tri am (vd
  // ?limit=-1) van la "truthy" nen vuot qua "|| 300", roi lam SELECT TOP (@limit) bao loi SQL
  // (TOP khong chap nhan gia tri am). Ep ve khoang [1, 1000] ro rang thay vi chi chan tren.
  const safeLimit = Math.min(Math.max(Number(limit) || 300, 1), 1000);
  const request = pool.request().input('limit', sql.Int, safeLimit);

  let filter = '1 = 1';
  if (fromDate) {
    request.input('fromDate', sql.Date, fromDate);
    filter += ' AND CAST(sl.CreatedDate AS DATE) >= @fromDate';
  }
  if (toDate) {
    request.input('toDate', sql.Date, toDate);
    filter += ' AND CAST(sl.CreatedDate AS DATE) <= @toDate';
  }
  if (connectionName) {
    request.input('connectionName', sql.NVarChar(100), connectionName);
    filter += ' AND sl.ConnectionName = @connectionName';
  }

  const result = await request.query(`
    SELECT TOP (@limit)
      sl.Id, sl.UserId, sl.UserName, sl.LocationsDetail,
      COALESCE(ru.PartnerName, ld.LocationName, sl.LocationsDetail) AS LocationDisplayName,
      sl.VoucherCode, sl.ScanMethod, sl.Action,
      sl.ResultStatus, sl.ValueAmt, sl.CoreApiHttpStatus, sl.CoreApiMessage, sl.ClientIp, sl.CreatedDate
    FROM dbo.VoucherScanLogs sl
    ${LOCATION_NAME_JOIN}
    WHERE ${filter}
    ORDER BY sl.CreatedDate DESC
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
      locationsDetail: sanitizeExcelText(row.LocationDisplayName || row.LocationsDetail),
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
