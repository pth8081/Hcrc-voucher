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

module.exports = { listGroups, listDetails, getDetailNameByCode };
