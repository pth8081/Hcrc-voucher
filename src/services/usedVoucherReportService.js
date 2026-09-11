const ExcelJS = require('exceljs');
const { sql, getPool } = require('../config/db');

const UNASSIGNED_COMPANY = 'Chua gan cong ty';
const UNASSIGNED_POINT = 'Chua xac dinh diem tieu';

// Gioi han so dong toi da khi xuat Excel - de trong ca 2 o ngay (xuat toan bo lich su, cang
// ngay cang lon) khong bi treo/qua tai server neu ai do bam xuat nhieu lan lien tuc.
const MAX_EXPORT_ROWS = 20000;

// H11: gioi han so dong toi da khi XEM (khong phai xuat Excel) - truoc day API nay khong gioi
// han gi ca va khong bat buoc chon khoang ngay, nen 1 nhan vien binh thuong goi khong tham so
// co the keo ve TOAN BO lich su nhieu nam roi render thang vao 1 bang HTML khong ao (khong
// phan trang) - rui ro treo trinh duyet/qua tai server. Nho hon nhieu so voi MAX_EXPORT_ROWS
// vi day la de HIEN THI (nguoi dung khong doc noi vai chuc nghin dong tren man hinh), khong
// phai de doi soat day du (viec do da co nut Xuat Excel voi gioi han rieng, cao hon).
const MAX_LIST_ROWS = 3000;

/**
 * Danh sach PHANG (khong cong don) toan bo voucher DA SU DUNG - moi dong trong VOUCHER_SYNC la
 * 1 voucher da duoc redeem qua app nay, nen bao cao nay chinh la "SELECT * FROM VOUCHER_SYNC"
 * kem ten Cong ty/Diem tieu. Tach biet voi bao cao tong hop (cong don theo Cong ty -> Diem tieu,
 * muc 12) va bao cao doi soat theo ngay (muc 5/6) - dung cho doi soat/kiem toan chi tiet tung
 * giao dich va xuat Excel.
 *
 * fromDate/toDate = null -> KHONG loc theo ngay (lay TOAN BO lich su).
 * visibleLocationCodes (xem reportAccessService.js): null = xem het, [] = khong xem gi ca,
 * [...] = chi xem dung cac dia diem do.
 */
async function listUsedVouchers({ fromDate, toDate, visibleLocationCodes, maxRows }) {
  const pool = await getPool();
  const request = pool.request();

  const topClause = maxRows ? 'TOP (@maxRows)' : '';
  if (maxRows) request.input('maxRows', sql.Int, maxRows);

  let dateFilter = '';
  if (fromDate) {
    request.input('fromDate', sql.Date, fromDate);
    dateFilter += ' AND CAST(vs.Created_Date AS DATE) >= @fromDate';
  }
  if (toDate) {
    request.input('toDate', sql.Date, toDate);
    dateFilter += ' AND CAST(vs.Created_Date AS DATE) <= @toDate';
  }

  let locationFilter = '';
  if (visibleLocationCodes !== null && visibleLocationCodes !== undefined) {
    if (!visibleLocationCodes.length) {
      locationFilter = ' AND 1 = 0';
    } else {
      const placeholders = visibleLocationCodes.map((code, i) => {
        request.input(`locCode${i}`, sql.NVarChar(100), code);
        return `@locCode${i}`;
      });
      locationFilter = ` AND LTRIM(RTRIM(vs.Locations_Detail)) IN (${placeholders.join(', ')})`;
    }
  }

  const result = await request.query(`
    SELECT ${topClause}
      vs.Created_Date, vs.TRANS_NUM, vs.Voucher_Code, vs.Voucher_Serial, vs.User_Name,
      vs.Locations_Detail, vs.Location_DetailName, vs.VALUE_AMT, vs.Sync,
      ru.PartnerName, rc.CompanyName
    FROM dbo.VOUCHER_SYNC vs
    LEFT JOIN (
      -- M8: xem ghi chu chi tiet o summaryReportService.js (cung 1 loi, cung cach sua) - uu tien
      -- dong DA co anh xa RedemptionUnits truoc khi chon dai dien cho 1 LocationCode bi trung.
      SELECT id, LTRIM(RTRIM(LocationCode)) AS LocationCode,
        ROW_NUMBER() OVER (
          PARTITION BY LTRIM(RTRIM(LocationCode))
          ORDER BY CASE WHEN EXISTS (SELECT 1 FROM dbo.RedemptionUnits ru0 WHERE ru0.LocationDetailId = d.id) THEN 0 ELSE 1 END, id
        ) AS rn
      FROM dbo.Locations_Detail d
    ) ld ON ld.LocationCode = LTRIM(RTRIM(vs.Locations_Detail)) AND ld.rn = 1
    LEFT JOIN dbo.RedemptionUnits ru ON ru.LocationDetailId = ld.id
    LEFT JOIN dbo.RedemptionCompanies rc ON rc.Id = ru.CompanyId
    WHERE 1 = 1${dateFilter}${locationFilter}
    ORDER BY vs.Created_Date DESC
  `);

  return result.recordset.map((row) => ({
    createdDate: row.Created_Date,
    transNum: row.TRANS_NUM,
    voucherCode: row.Voucher_Code,
    voucherSerial: row.Voucher_Serial,
    userName: row.User_Name,
    locationsDetail: row.Locations_Detail,
    companyName: row.CompanyName || UNASSIGNED_COMPANY,
    pointName: row.PartnerName || row.Location_DetailName || row.Locations_Detail || UNASSIGNED_POINT,
    valueAmt: Number(row.VALUE_AMT || 0),
    synced: row.Sync === 'Y',
  }));
}

// L1: exceljs ghi cac cot text o day dung KIEU CHUOI that su (khong phai formula), nen rui ro
// CSV/Excel-injection thuc te da thap san - nhung 1 vai trinh xem file khac (khong phai Excel
// that) van co the tu dien giai lai 1 chuoi bat dau bang =/+/-/@ nhu cong thuc. Cac cot nay co
// the chua du lieu Core tra ve (voucherSerial) hoac ho ten nguoi dung go tu do (userName, tao
// qua man hinh Tai khoan) - them 1 dau nhay don o dau NEU chuoi bat dau bang cac ky tu do, ep
// hien thi nhu van ban thuan tuy trong moi truong doc file, khong doi du lieu that trong o.
const FORMULA_PREFIX_REGEX = /^[=+\-@\t\r]/;
function sanitizeExcelText(value) {
  if (value === null || value === undefined) return value;
  const str = String(value);
  return FORMULA_PREFIX_REGEX.test(str) ? `'${str}` : str;
}

/** Xuat danh sach da lay o tren ra 1 file Excel (.xlsx) that, tra ve dang Buffer. */
async function buildExcelBuffer(rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Voucher da su dung');

  sheet.columns = [
    { header: 'Ngay tieu', key: 'createdDate', width: 20 },
    { header: 'Ma giao dich', key: 'transNum', width: 22 },
    { header: 'Ma voucher', key: 'voucherCode', width: 18 },
    { header: 'Serial', key: 'voucherSerial', width: 18 },
    { header: 'Nguoi tieu', key: 'userName', width: 24 },
    { header: 'Cong ty', key: 'companyName', width: 26 },
    { header: 'Diem tieu', key: 'pointName', width: 26 },
    { header: 'Ma dia diem', key: 'locationsDetail', width: 14 },
    { header: 'So tien', key: 'valueAmt', width: 14 },
    { header: 'Dong bo', key: 'syncedLabel', width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  rows.forEach((row) => {
    sheet.addRow({
      ...row,
      transNum: sanitizeExcelText(row.transNum),
      voucherCode: sanitizeExcelText(row.voucherCode),
      voucherSerial: sanitizeExcelText(row.voucherSerial),
      userName: sanitizeExcelText(row.userName),
      companyName: sanitizeExcelText(row.companyName),
      pointName: sanitizeExcelText(row.pointName),
      locationsDetail: sanitizeExcelText(row.locationsDetail),
      createdDate: row.createdDate ? new Date(row.createdDate) : null,
      syncedLabel: row.synced ? 'Da dong bo' : 'Cho dong bo',
    });
  });

  sheet.getColumn('createdDate').numFmt = 'dd/mm/yyyy hh:mm';
  sheet.getColumn('valueAmt').numFmt = '#,##0';

  return workbook.xlsx.writeBuffer();
}

module.exports = { listUsedVouchers, buildExcelBuffer, MAX_EXPORT_ROWS, MAX_LIST_ROWS };
