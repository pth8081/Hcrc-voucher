const ExcelJS = require('exceljs');
const { sql, getPool } = require('../config/db');

// Gioi han so dong toi da cho CHI TIET khi xuat Excel (cung muc voi MAX_EXPORT_ROWS trong
// usedVoucherReportService.js) - bang Tong hop theo dia diem khong can gioi han vi so dong luon
// nho (so luong dia diem thuc te, khong phai so giao dich).
const MAX_EXPORT_ROWS = 20000;

/**
 * Them dieu kien loc theo danh sach ma dia diem duoc phep xem (xem reportAccessService.js).
 * codes = null -> khong loc gi (duoc xem toan bo). codes = [] -> khong duoc xem dia diem nao
 * ca (khoa tai khoan chua duoc gan dia diem/cong ty nao). codes = [...] -> chi xem dung cac
 * dia diem do.
 */
function buildLocationCodeFilter(request, codes, column) {
  if (codes === null) return '';
  if (!codes.length) return ' AND 1 = 0';
  const placeholders = codes.map((code, i) => {
    request.input(`locCode${i}`, sql.NVarChar(100), code);
    return `@locCode${i}`;
  });
  return ` AND LTRIM(RTRIM(${column})) IN (${placeholders.join(', ')})`;
}

/**
 * M8 (xem ghi chu chi tiet cung noi dung o summaryReportService.js/usedVoucherReportService.js):
 * anh xa Locations_Detail (chuoi tho trong VOUCHER_SYNC) sang Don vi thu hoi/Cong ty da dang ky,
 * uu tien dong DA co anh xa RedemptionUnits truoc khi chon dai dien cho 1 LocationCode bi trung.
 * Dung chung cho ca loc theo cong ty/diem thu hoi (muc nay) lan 3 ham liet ke bo loc o duoi.
 */
const LOCATION_MAPPING_JOIN = `
  LEFT JOIN (
    SELECT id, LTRIM(RTRIM(LocationCode)) AS LocationCode,
      ROW_NUMBER() OVER (
        PARTITION BY LTRIM(RTRIM(LocationCode))
        ORDER BY CASE WHEN EXISTS (SELECT 1 FROM dbo.RedemptionUnits ru0 WHERE ru0.LocationDetailId = d.id) THEN 0 ELSE 1 END, id
      ) AS rn
    FROM dbo.Locations_Detail d
  ) ld ON ld.LocationCode = LTRIM(RTRIM(vs.Locations_Detail)) AND ld.rn = 1
  LEFT JOIN dbo.RedemptionUnits ru ON ru.LocationDetailId = ld.id
  LEFT JOIN dbo.RedemptionCompanies rc ON rc.Id = ru.CompanyId
`;

// VoucherRedemptionConnections: bang app tu tao, khoa theo TRANS_NUM, ghi lai HE THONG VOUCHER
// (BRGmart/Fuji...) da xu ly 1 giao dich - xem sql/027_create_voucher_redemption_connections.sql.
// LEFT JOIN (khong phai INNER) de khong lam mat cac dong CU (truoc khi co tinh nang nhieu he
// thong) chua co ban ghi tuong ung, khi KHONG loc theo he thong.
const VOUCHER_CONNECTION_JOIN = `
  LEFT JOIN dbo.VoucherRedemptionConnections vrc ON vrc.TransNum = vs.TRANS_NUM
`;

/**
 * Loc theo he thong voucher (connectionIds): null = khong loc (xem toan bo), [] = khong duoc
 * xem he thong nao (tai khoan bi khoa het quyen), [...] = chi xem dung cac Id do. Dung CA cho
 * loc tuy chon nguoi dung chon (1 phan tu) LAN cho gioi han quyen theo tai khoan (co the nhieu
 * phan tu) - xem report.controller.js#resolveConnectionFilter. Can VOUCHER_CONNECTION_JOIN
 * (alias vrc) da co san trong cau truy van goi ham nay.
 *
 * M12 (loi that da bao cao): giao dich CU (truoc khi co tinh nang nhieu he thong voucher,
 * sql/027) khong co ban ghi VoucherRedemptionConnections tuong ung (vrc.ConnectionId = NULL).
 * Dieu kien "vrc.ConnectionId IN (...)" truoc day KHONG khop NULL - nen BAT KY tai khoan nao bi
 * gioi han he thong (ke ca admin, neu chinh tai khoan do bi gan gioi han) deu mat trang TOAN BO
 * du lieu cu nay trong ca 3 bao cao, dung y "LEFT JOIN de khong mat du lieu cu" (xem comment o
 * VOUCHER_CONNECTION_JOIN) chi dung duoc 1 nua (chi dung khi KHONG loc gi). Sua: coi du lieu CU
 * (chua tung duoc gan he thong nao) la LUON duoc xem, giong het cach LOCATION_MAPPING_JOIN da xu
 * ly du lieu cu chua gan Cong ty/Diem thu hoi (hien "Chua gan cong ty" thay vi bi an mat).
 */
function buildConnectionFilter(request, connectionIds) {
  if (connectionIds === null) return '';
  if (!connectionIds.length) return ' AND 1 = 0';
  const placeholders = connectionIds.map((id, i) => {
    request.input(`connId${i}`, sql.Int, id);
    return `@connId${i}`;
  });
  return ` AND (vrc.ConnectionId IS NULL OR vrc.ConnectionId IN (${placeholders.join(', ')}))`;
}

/** Loc THEM theo cong ty/diem thu hoi/tai khoan thu hoi (tuy chon, bo qua neu khong truyen) -
 * dung chung cho ca 3 bao cao (doi soat, tong hop, danh sach voucher da su dung). Can
 * LOCATION_MAPPING_JOIN (alias ru/rc) da co san trong cau truy van goi ham nay, va bang chinh
 * phai la VOUCHER_SYNC voi alias "vs" (cho vs.userid). */
function buildExtraFilters(request, { companyId, redemptionUnitId, userId, connectionIds }) {
  let filter = '';
  if (companyId) {
    request.input('filterCompanyId', sql.Int, companyId);
    filter += ' AND rc.Id = @filterCompanyId';
  }
  if (redemptionUnitId) {
    request.input('filterRedemptionUnitId', sql.Int, redemptionUnitId);
    filter += ' AND ru.Id = @filterRedemptionUnitId';
  }
  if (userId) {
    request.input('filterUserId', sql.Int, userId);
    filter += ' AND vs.userid = @filterUserId';
  }
  filter += buildConnectionFilter(request, connectionIds !== undefined ? connectionIds : null);
  return filter;
}

/**
 * Bao cao doi soat: tong hop voucher da thu hoi theo don vi trong 1 KHOANG NGAY (tu ngay - den
 * ngay, co the chi la 1 ngay neu fromDate = toDate), dung de doi chieu voi bao cao phat hanh cua
 * Core system. Truoc day chi loc dung 1 ngay (tham so `date`) - doi sang khoang ngay theo yeu
 * cau nguoi dung, giong cach 2 bao cao con lai (tong hop, danh sach voucher da su dung) da lam.
 */
async function dailyReconciliation({ fromDate, toDate, locationsDetail, visibleLocationCodes, companyId, redemptionUnitId, userId, connectionIds, maxDetailRows }) {
  const pool = await getPool();
  const request = pool.request();
  request.input('fromDate', sql.Date, fromDate).input('toDate', sql.Date, toDate);
  let filter = 'CAST(vs.Created_Date AS DATE) BETWEEN @fromDate AND @toDate';
  if (locationsDetail) {
    request.input('locationsDetail', sql.NVarChar(100), locationsDetail);
    filter += ' AND vs.Locations_Detail = @locationsDetail';
  }
  filter += buildLocationCodeFilter(request, visibleLocationCodes, 'vs.Locations_Detail');
  filter += buildExtraFilters(request, { companyId, redemptionUnitId, userId, connectionIds });

  const summary = await request.query(`
    SELECT
      vs.Locations_Group, vs.Location_GroupName, vs.Locations_Detail, vs.Location_DetailName,
      COUNT(*) AS VoucherCount,
      SUM(vs.VALUE_AMT) AS TotalAmount
    FROM dbo.VOUCHER_SYNC vs
    ${LOCATION_MAPPING_JOIN}
    ${VOUCHER_CONNECTION_JOIN}
    WHERE ${filter}
    GROUP BY vs.Locations_Group, vs.Location_GroupName, vs.Locations_Detail, vs.Location_DetailName
    ORDER BY vs.Location_DetailName
  `);

  const detailRequest = pool.request();
  detailRequest.input('fromDate', sql.Date, fromDate).input('toDate', sql.Date, toDate);
  let detailFilter = 'CAST(vs.Created_Date AS DATE) BETWEEN @fromDate AND @toDate';
  if (locationsDetail) {
    detailRequest.input('locationsDetail', sql.NVarChar(100), locationsDetail);
    detailFilter += ' AND vs.Locations_Detail = @locationsDetail';
  }
  detailFilter += buildLocationCodeFilter(detailRequest, visibleLocationCodes, 'vs.Locations_Detail');
  detailFilter += buildExtraFilters(detailRequest, { companyId, redemptionUnitId, userId, connectionIds });

  const topClause = maxDetailRows ? 'TOP (@maxDetailRows)' : '';
  if (maxDetailRows) detailRequest.input('maxDetailRows', sql.Int, maxDetailRows);

  const details = await detailRequest.query(`
    SELECT ${topClause}
      vs.Id, vs.User_Name, vs.TRANS_NUM, vs.Voucher_Serial, vs.Voucher_Code, vs.Created_Date,
      vs.Status, vs.Locations_Group, vs.Location_GroupName, vs.Locations_Detail, vs.Location_DetailName,
      vs.VALUE_AMT, vs.Sync, vrc.ConnectionName
    FROM dbo.VOUCHER_SYNC vs
    ${LOCATION_MAPPING_JOIN}
    ${VOUCHER_CONNECTION_JOIN}
    WHERE ${detailFilter}
    ORDER BY vs.Created_Date DESC
  `);

  return {
    summary: summary.recordset,
    details: details.recordset,
  };
}

/**
 * 3 ham liet ke gia tri cho o loc "Cong ty thu hoi / Diem thu hoi / Tai khoan thu hoi" dung
 * chung cho ca 3 bao cao - SCOPE THEO visibleLocationCodes giong het du lieu bao cao chinh
 * (null = khong gioi han, [] = khong thay gi, [...] = chi trong danh sach do), de 1 nhan vien
 * khong thay duoc trong dropdown nhung cong ty/diem tieu ma ho khong co quyen xem du lieu.
 */
async function listFilterCompanies(visibleLocationCodes) {
  const pool = await getPool();
  const request = pool.request();
  const filter = buildLocationCodeFilter(request, visibleLocationCodes, 'd.LocationCode');
  const result = await request.query(`
    SELECT DISTINCT rc.Id, rc.CompanyName
    FROM dbo.RedemptionUnits ru
    INNER JOIN dbo.Locations_Detail d ON d.id = ru.LocationDetailId
    INNER JOIN dbo.RedemptionCompanies rc ON rc.Id = ru.CompanyId
    WHERE 1 = 1${filter}
    ORDER BY rc.CompanyName
  `);
  return result.recordset;
}

async function listFilterRedemptionUnits(visibleLocationCodes, companyId) {
  const pool = await getPool();
  const request = pool.request();
  let filter = buildLocationCodeFilter(request, visibleLocationCodes, 'd.LocationCode');
  if (companyId) {
    request.input('companyId', sql.Int, companyId);
    filter += ' AND ru.CompanyId = @companyId';
  }
  const result = await request.query(`
    SELECT ru.Id, ru.PartnerName, ru.CompanyId, rc.CompanyName
    FROM dbo.RedemptionUnits ru
    INNER JOIN dbo.Locations_Detail d ON d.id = ru.LocationDetailId
    LEFT JOIN dbo.RedemptionCompanies rc ON rc.Id = ru.CompanyId
    WHERE 1 = 1${filter}
    ORDER BY rc.CompanyName, ru.PartnerName
  `);
  return result.recordset;
}

/**
 * M11 (loi that da bao cao): truoc day liet ke tai khoan tu LICH SU giao dich (DISTINCT
 * vs.userid trong VOUCHER_SYNC) - khong lien quan gi den tai khoan do CO DANG duoc gan dung
 * "Diem thu hoi" dang loc hay khong, nen chon 1 Diem thu hoi van thay duoc ca nhung tai khoan
 * chua bao gio/khong con gan diem do trong o chon "Tai khoan thu hoi" (ket hop lai se luon ra
 * bao cao rong, gay nham lan). Doi nguon sang chinh bang `Users` (theo dung gan ket hien tai,
 * Users.Locations_Detail), loc THEM dung locationCode cua Diem thu hoi dang chon neu co - xem
 * report.controller.js#filterRedeemers. Bo qua tai khoan da bi xoa mem (UserAccountSchedule).
 */
async function listFilterRedeemers(visibleLocationCodes, locationCode) {
  const pool = await getPool();
  const request = pool.request();
  let filter = buildLocationCodeFilter(request, visibleLocationCodes, 'u.Locations_Detail');
  if (locationCode) {
    request.input('locationCode', sql.NVarChar(100), locationCode);
    filter += ' AND LTRIM(RTRIM(u.Locations_Detail)) = @locationCode';
  }
  const result = await request.query(`
    SELECT DISTINCT u.UserID AS userId, u.FullName AS userName
    FROM dbo.Users u
    LEFT JOIN dbo.UserAccountSchedule s ON s.UserId = u.UserID
    WHERE u.Locations_Detail IS NOT NULL AND ISNULL(s.IsDeleted, 0) = 0${filter}
    ORDER BY u.FullName
  `);
  return result.recordset;
}

// L1: xem giai thich day du o usedVoucherReportService.js - them 1 dau nhay don o dau chuoi NEU
// bat dau bang =/+/-/@ de ep hien thi nhu van ban thuan tuy, tranh 1 so trinh xem file dien giai
// nham thanh cong thuc.
const FORMULA_PREFIX_REGEX = /^[=+\-@\t\r]/;
function sanitizeExcelText(value) {
  if (value === null || value === undefined) return value;
  const str = String(value);
  return FORMULA_PREFIX_REGEX.test(str) ? `'${str}` : str;
}

/**
 * Xuat Bao cao doi soat ra Excel - 2 sheet: "Tong hop theo dia diem" (giong bang tong hop tren
 * man hinh) va "Chi tiet giao dich" (giong bang chi tiet tren man hinh, co gioi han MAX_EXPORT_ROWS).
 */
async function buildReconciliationExcelBuffer({ summary, details }) {
  const workbook = new ExcelJS.Workbook();

  const summarySheet = workbook.addWorksheet('Tong hop theo dia diem');
  summarySheet.columns = [
    { header: 'Nhom dia diem', key: 'groupName', width: 22 },
    { header: 'Dia diem', key: 'pointName', width: 28 },
    { header: 'So luong', key: 'voucherCount', width: 14 },
    { header: 'Tong tien', key: 'totalAmount', width: 16 },
  ];
  summarySheet.getRow(1).font = { bold: true };
  summary.forEach((row) => {
    summarySheet.addRow({
      groupName: sanitizeExcelText(row.Location_GroupName || row.Locations_Group),
      pointName: sanitizeExcelText(row.Location_DetailName || row.Locations_Detail),
      voucherCount: row.VoucherCount,
      totalAmount: Number(row.TotalAmount || 0),
    });
  });
  summarySheet.getColumn('totalAmount').numFmt = '#,##0';

  const detailSheet = workbook.addWorksheet('Chi tiet giao dich');
  detailSheet.columns = [
    { header: 'Ngay gio', key: 'createdDate', width: 20 },
    { header: 'Ma giao dich', key: 'transNum', width: 22 },
    { header: 'Ma voucher', key: 'voucherCode', width: 18 },
    { header: 'Serial', key: 'voucherSerial', width: 18 },
    { header: 'Nguoi thu hoi', key: 'userName', width: 24 },
    { header: 'Nhom dia diem', key: 'groupName', width: 22 },
    { header: 'Dia diem', key: 'pointName', width: 28 },
    { header: 'He thong', key: 'connectionName', width: 16 },
    { header: 'Menh gia', key: 'valueAmt', width: 14 },
    { header: 'Dong bo', key: 'syncedLabel', width: 14 },
  ];
  detailSheet.getRow(1).font = { bold: true };
  details.forEach((row) => {
    detailSheet.addRow({
      createdDate: row.Created_Date ? new Date(row.Created_Date) : null,
      transNum: sanitizeExcelText(row.TRANS_NUM),
      voucherCode: sanitizeExcelText(row.Voucher_Code),
      voucherSerial: sanitizeExcelText(row.Voucher_Serial),
      userName: sanitizeExcelText(row.User_Name),
      groupName: sanitizeExcelText(row.Location_GroupName || row.Locations_Group),
      pointName: sanitizeExcelText(row.Location_DetailName || row.Locations_Detail),
      connectionName: sanitizeExcelText(row.ConnectionName || '-'),
      valueAmt: Number(row.VALUE_AMT || 0),
      syncedLabel: row.Sync === 'Y' ? 'Da dong bo' : 'Cho dong bo',
    });
  });
  detailSheet.getColumn('createdDate').numFmt = 'dd/mm/yyyy hh:mm';
  detailSheet.getColumn('valueAmt').numFmt = '#,##0';

  return workbook.xlsx.writeBuffer();
}

module.exports = {
  dailyReconciliation,
  listFilterCompanies,
  listFilterRedemptionUnits,
  listFilterRedeemers,
  buildReconciliationExcelBuffer,
  MAX_EXPORT_ROWS,
};
