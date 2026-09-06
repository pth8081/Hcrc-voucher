const ExcelJS = require('exceljs');
const { sql, getPool } = require('../config/db');

const UNASSIGNED_COMPANY = 'Chua gan cong ty';
const UNASSIGNED_POINT = 'Chua xac dinh diem tieu';

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
async function listUsedVouchers({ fromDate, toDate, visibleLocationCodes }) {
  const pool = await getPool();
  const request = pool.request();

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
      locationFilter = ` AND vs.Locations_Detail IN (${placeholders.join(', ')})`;
    }
  }

  const result = await request.query(`
    SELECT
      vs.Created_Date, vs.TRANS_NUM, vs.Voucher_Code, vs.Voucher_Serial, vs.User_Name,
      vs.Locations_Detail, vs.Location_DetailName, vs.VALUE_AMT, vs.Sync,
      ru.PartnerName, rc.CompanyName
    FROM dbo.VOUCHER_SYNC vs
    LEFT JOIN dbo.Locations_Detail ld ON LTRIM(RTRIM(ld.LocationCode)) = LTRIM(RTRIM(vs.Locations_Detail))
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
      createdDate: row.createdDate ? new Date(row.createdDate) : null,
      syncedLabel: row.synced ? 'Da dong bo' : 'Cho dong bo',
    });
  });

  sheet.getColumn('createdDate').numFmt = 'dd/mm/yyyy hh:mm';
  sheet.getColumn('valueAmt').numFmt = '#,##0';

  return workbook.xlsx.writeBuffer();
}

module.exports = { listUsedVouchers, buildExcelBuffer };
