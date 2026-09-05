const { sql, getPool } = require('../config/db');

/**
 * Them dieu kien loc theo danh sach ma dia diem duoc phep xem (xem reportAccessService.js).
 * codes = null -> khong loc gi (duoc xem toan bo). codes = [] -> khong duoc xem dia diem nao
 * ca (khoa tai khoan chua duoc gan dia diem/cong ty nao). codes = [...] -> chi xem dung cac
 * dia diem do.
 */
function buildLocationCodeFilter(request, codes) {
  if (codes === null) return '';
  if (!codes.length) return ' AND 1 = 0';
  const placeholders = codes.map((code, i) => {
    request.input(`locCode${i}`, sql.NVarChar(100), code);
    return `@locCode${i}`;
  });
  return ` AND Locations_Detail IN (${placeholders.join(', ')})`;
}

/**
 * Bao cao doi soat hang ngay: tong hop voucher da thu hoi theo don vi,
 * dung de doi chieu voi bao cao phat hanh cua Core system.
 */
async function dailyReconciliation({ date, locationsDetail, visibleLocationCodes }) {
  const pool = await getPool();
  const request = pool.request();
  request.input('reportDate', sql.Date, date);
  let filter = 'CAST(Created_Date AS DATE) = @reportDate';
  if (locationsDetail) {
    request.input('locationsDetail', sql.NVarChar(100), locationsDetail);
    filter += ' AND Locations_Detail = @locationsDetail';
  }
  filter += buildLocationCodeFilter(request, visibleLocationCodes);

  const summary = await request.query(`
    SELECT
      Locations_Group,
      Location_GroupName,
      Locations_Detail,
      Location_DetailName,
      COUNT(*) AS VoucherCount,
      SUM(VALUE_AMT) AS TotalAmount
    FROM dbo.VOUCHER_SYNC
    WHERE ${filter}
    GROUP BY Locations_Group, Location_GroupName, Locations_Detail, Location_DetailName
    ORDER BY Location_DetailName
  `);

  const detailRequest = pool.request();
  detailRequest.input('reportDate', sql.Date, date);
  let detailFilter = 'CAST(Created_Date AS DATE) = @reportDate';
  if (locationsDetail) {
    detailRequest.input('locationsDetail', sql.NVarChar(100), locationsDetail);
    detailFilter += ' AND Locations_Detail = @locationsDetail';
  }
  detailFilter += buildLocationCodeFilter(detailRequest, visibleLocationCodes);

  const details = await detailRequest.query(`
    SELECT
      Id, User_Name, TRANS_NUM, Voucher_Serial, Voucher_Code, Created_Date,
      Status, Locations_Group, Location_GroupName, Locations_Detail, Location_DetailName,
      VALUE_AMT, Sync
    FROM dbo.VOUCHER_SYNC
    WHERE ${detailFilter}
    ORDER BY Created_Date DESC
  `);

  return {
    summary: summary.recordset,
    details: details.recordset,
  };
}

module.exports = { dailyReconciliation };
