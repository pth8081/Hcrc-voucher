const { sql, getPool } = require('../config/db');

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
 */
function buildConnectionFilter(request, connectionIds) {
  if (connectionIds === null) return '';
  if (!connectionIds.length) return ' AND 1 = 0';
  const placeholders = connectionIds.map((id, i) => {
    request.input(`connId${i}`, sql.Int, id);
    return `@connId${i}`;
  });
  return ` AND vrc.ConnectionId IN (${placeholders.join(', ')})`;
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
async function dailyReconciliation({ fromDate, toDate, locationsDetail, visibleLocationCodes, companyId, redemptionUnitId, userId, connectionIds }) {
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

  const details = await detailRequest.query(`
    SELECT
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

async function listFilterRedeemers(visibleLocationCodes) {
  const pool = await getPool();
  const request = pool.request();
  const filter = buildLocationCodeFilter(request, visibleLocationCodes, 'vs.Locations_Detail');
  const result = await request.query(`
    SELECT DISTINCT vs.userid AS userId, vs.User_Name AS userName
    FROM dbo.VOUCHER_SYNC vs
    WHERE vs.userid IS NOT NULL${filter}
    ORDER BY vs.User_Name
  `);
  return result.recordset;
}

module.exports = { dailyReconciliation, listFilterCompanies, listFilterRedemptionUnits, listFilterRedeemers };
