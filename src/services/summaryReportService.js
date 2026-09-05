const { sql, getPool } = require('../config/db');

const UNASSIGNED_COMPANY = 'Chua gan cong ty';
const UNASSIGNED_POINT = 'Chua xac dinh diem tieu';

/**
 * Bao cao TONG HOP thu hoi voucher theo khoang ngay - tach biet voi "Bao cao doi soat"
 * (muc /reports/daily, nhom theo Locations_Group/Locations_Detail cua tung tai khoan).
 * Bao cao nay nhom theo CONG TY (RedemptionCompanies) -> DIEM TIEU (RedemptionUnits.PartnerName),
 * vi 1 cong ty co the co nhieu diem tieu (xem sql/009, sql/010) - dung de bao cao cho tung
 * cong ty doi tac va tong hop toan bo cac cong ty.
 */
async function consolidatedReport({ fromDate, toDate }) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('fromDate', sql.Date, fromDate)
    .input('toDate', sql.Date, toDate)
    .query(`
      SELECT
        vs.User_Name, vs.TRANS_NUM, vs.Voucher_Serial, vs.Voucher_Code, vs.Created_Date,
        vs.Locations_Detail, vs.Location_DetailName, vs.VALUE_AMT, vs.Sync,
        ru.PartnerName, ru.CompanyId, rc.CompanyName
      FROM dbo.VOUCHER_SYNC vs
      LEFT JOIN dbo.Locations_Detail ld ON LTRIM(RTRIM(ld.LocationCode)) = LTRIM(RTRIM(vs.Locations_Detail))
      LEFT JOIN dbo.RedemptionUnits ru ON ru.LocationDetailId = ld.id
      LEFT JOIN dbo.RedemptionCompanies rc ON rc.Id = ru.CompanyId
      WHERE CAST(vs.Created_Date AS DATE) BETWEEN @fromDate AND @toDate
      ORDER BY rc.CompanyName, ru.PartnerName, vs.Created_Date
    `);

  return buildHierarchy(result.recordset);
}

function buildHierarchy(rows) {
  const companyMap = new Map(); // companyKey -> { companyId, companyName, pointMap, count, amount }

  for (const row of rows) {
    const companyKey = row.CompanyId != null ? `id:${row.CompanyId}` : 'unassigned';
    if (!companyMap.has(companyKey)) {
      companyMap.set(companyKey, {
        companyId: row.CompanyId,
        companyName: row.CompanyName || UNASSIGNED_COMPANY,
        pointMap: new Map(),
        count: 0,
        amount: 0,
      });
    }
    const company = companyMap.get(companyKey);

    const pointName = row.PartnerName || row.Location_DetailName || row.Locations_Detail || UNASSIGNED_POINT;
    if (!company.pointMap.has(pointName)) {
      company.pointMap.set(pointName, { pointName, rows: [], count: 0, amount: 0 });
    }
    const point = company.pointMap.get(pointName);

    const amount = Number(row.VALUE_AMT || 0);
    point.rows.push({
      createdDate: row.Created_Date,
      userName: row.User_Name,
      transNum: row.TRANS_NUM,
      voucherCode: row.Voucher_Code,
      voucherSerial: row.Voucher_Serial,
      valueAmt: amount,
      synced: row.Sync === 'Y',
    });
    point.count += 1;
    point.amount += amount;
    company.count += 1;
    company.amount += amount;
  }

  const companies = Array.from(companyMap.values()).map((c) => ({
    companyId: c.companyId,
    companyName: c.companyName,
    count: c.count,
    amount: c.amount,
    points: Array.from(c.pointMap.values()),
  }));

  const grandTotal = companies.reduce(
    (acc, c) => ({ count: acc.count + c.count, amount: acc.amount + c.amount }),
    { count: 0, amount: 0 }
  );

  return { companies, grandTotal };
}

module.exports = { consolidatedReport };
