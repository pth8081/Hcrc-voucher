const { sql, getPool } = require('../config/db');

// Luu y: schema goc khong co cot lien ket truc tiep giua Locations_Group va
// Locations_Detail (VOUCHER_SYNC luu ca 2 ma nhu 2 truong doc lap). Neu can
// loc chi tiet theo nhom, bo sung cot GroupId vao Locations_Detail hoac dung
// bang RedemptionUnits (xem sql/001_create_redemption_units.sql).

async function listGroups() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT id, LocationType, LTRIM(RTRIM(LocationName)) AS LocationName, Status
    FROM dbo.Locations_Group
    WHERE Status = 1 OR Status IS NULL
    ORDER BY LocationName
  `);
  return result.recordset;
}

async function listDetails() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      d.id,
      d.LocationType,
      LTRIM(RTRIM(d.LocationCode)) AS LocationCode,
      LTRIM(RTRIM(d.LocationName)) AS LocationName,
      d.Status
    FROM dbo.Locations_Detail d
    WHERE (d.Status = 1 OR d.Status IS NULL)
    ORDER BY d.LocationName
  `);
  return result.recordset;
}

// Locations_Detail.LocationType: cot NOT NULL ke thua tu phan mem cu (nchar(10)), gia tri hien
// co trong du lieu cu la cac so nho (1,2,3...) khong co y nghia ro rang va app nay khong doc/loc
// theo cot nay o bat ky dau - dat 1 gia tri co dinh cho moi dia diem tao moi qua app, KHONG dong
// tac dong gi den du lieu cu.
const NEW_LOCATION_TYPE = '1';

/**
 * Tao moi 1 dia diem (1 dong Locations_Detail) - dung khi diem tieu/cua hang CHUA TUNG ton tai
 * trong du lieu cu, khong co san de chon trong dropdown "Dia diem" (listDetails() o tren chi
 * liet ke du lieu DA CO, khong tao moi duoc). Theo yeu cau nguoi dung: KHONG dong den du lieu
 * Locations_Detail cu da co san (van giu nguyen ma trung neu co) - chi dam bao dia diem MOI tao
 * qua app nay co 1 LocationCode rieng, khong trung voi bat ky dong nao khac (cu lan moi).
 *
 * LocationCode (nvarchar(10), NOT NULL) duoc dat BANG id noi bo (cot IDENTITY, Luon duy nhat
 * tuyet doi) - vi id chi biet duoc SAU KHI insert, lam 2 buoc: insert truoc voi 1 gia tri tam,
 * roi UPDATE lai dung id ngay sau do (2 cau lenh noi tiep, du cho 1 thao tac quan tri hiem khi
 * xay ra dong thoi).
 */
async function createDetail(locationName) {
  const pool = await getPool();
  const insertResult = await pool
    .request()
    .input('locationType', sql.NChar(10), NEW_LOCATION_TYPE)
    .input('locationName', sql.NChar(250), locationName)
    .query(`
      INSERT INTO dbo.Locations_Detail (LocationType, LocationCode, LocationName, Status)
      OUTPUT INSERTED.id
      VALUES (@locationType, N'0', @locationName, 1)
    `);
  const newId = insertResult.recordset[0].id;

  const newCode = String(newId);
  await pool
    .request()
    .input('id', sql.Int, newId)
    .input('locationCode', sql.NVarChar(10), newCode)
    .query('UPDATE dbo.Locations_Detail SET LocationCode = @locationCode WHERE id = @id');

  return { id: newId, locationCode: newCode };
}

/**
 * Tra ten dia diem theo ma (LocationCode) - dung de dien VOUCHER_SYNC.Location_DetailName
 * luc thu hoi (xem voucherService.js). Locations_Detail.LocationCode co du lieu ro rang de
 * doi chieu (khac Locations_Group - khong co cot ma nen KHONG the tra ten nhom tuong tu,
 * xem ghi chu dau file).
 */
async function getDetailNameByCode(code) {
  if (!code) return null;
  const pool = await getPool();
  const result = await pool
    .request()
    .input('code', sql.NVarChar(20), code)
    .query(`
      SELECT TOP 1 LTRIM(RTRIM(LocationName)) AS LocationName
      FROM dbo.Locations_Detail
      WHERE LTRIM(RTRIM(LocationCode)) = @code
    `);
  return result.recordset[0]?.LocationName || null;
}

module.exports = { listGroups, listDetails, createDetail, getDetailNameByCode };
