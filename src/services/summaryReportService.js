const ExcelJS = require('exceljs');
const { sql, getPool } = require('../config/db');

const UNASSIGNED_COMPANY = 'Chua gan cong ty';
const UNASSIGNED_POINT = 'Chua xac dinh diem tieu';

// Gioi han so dong giao dich toi da khi XUAT Excel (cung muc voi reportService.js/
// usedVoucherReportService.js) - khong anh huong man hinh xem thuong (khong truyen maxRows).
const MAX_EXPORT_ROWS = 20000;

/**
 * Bao cao TONG HOP thu hoi voucher theo khoang ngay - tach biet voi "Bao cao doi soat"
 * (muc /reports/daily, nhom theo Locations_Group/Locations_Detail cua tung tai khoan).
 * Bao cao nay nhom theo CONG TY (RedemptionCompanies) -> DIEM TIEU (RedemptionUnits.PartnerName),
 * vi 1 cong ty co the co nhieu diem tieu (xem sql/009, sql/010) - dung de bao cao cho tung
 * cong ty doi tac va tong hop toan bo cac cong ty.
 */
/**
 * visibleLocationCodes (xem reportAccessService.js): null = duoc xem toan bo (khong loc);
 * [] = khong duoc xem dia diem nao; [...] = chi xem dung cac dia diem do.
 * companyId/redemptionUnitId/userId = null -> KHONG loc them (xem reportService.js, cung 1 bo
 * loc tai khoan/cong ty/diem thu hoi dung chung cho ca 3 bao cao).
 */
async function consolidatedReport({ fromDate, toDate, visibleLocationCodes, companyId, redemptionUnitId, userId, connectionIds, includeUntaggedConnections, maxRows }) {
  const pool = await getPool();
  const request = pool.request().input('fromDate', sql.Date, fromDate).input('toDate', sql.Date, toDate);

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

  let extraFilter = '';
  if (companyId) {
    request.input('companyId', sql.Int, companyId);
    extraFilter += ' AND rc.Id = @companyId';
  }
  if (redemptionUnitId) {
    request.input('redemptionUnitId', sql.Int, redemptionUnitId);
    extraFilter += ' AND ru.Id = @redemptionUnitId';
  }
  if (userId) {
    request.input('userId', sql.Int, userId);
    extraFilter += ' AND vs.userid = @userId';
  }
  // He thong voucher (BRGmart/Fuji...) - xem reportService.js#buildConnectionFilter cho giai
  // thich day du y nghia null/[]/[...]; dung lai y het logic (khong import duoc ham do o day vi
  // request/alias khac nhau, nhung cung 1 quy uoc). M13/M15: "OR vrc.ConnectionId IS NULL" CHI ap
  // dung khi includeUntaggedConnections=true (tai khoan duoc tick RO RANG "Khac") - xem ghi chu
  // chi tiet o reportService.js#buildConnectionFilter.
  if (connectionIds !== null && connectionIds !== undefined) {
    if (!connectionIds.length) {
      extraFilter += includeUntaggedConnections ? ' AND vrc.ConnectionId IS NULL' : ' AND 1 = 0';
    } else {
      const placeholders = connectionIds.map((id, i) => {
        request.input(`connId${i}`, sql.Int, id);
        return `@connId${i}`;
      });
      const inClause = `vrc.ConnectionId IN (${placeholders.join(', ')})`;
      extraFilter += includeUntaggedConnections ? ` AND (vrc.ConnectionId IS NULL OR ${inClause})` : ` AND ${inClause}`;
    }
  }

  const topClause = maxRows ? 'TOP (@maxRows)' : '';
  if (maxRows) request.input('maxRows', sql.Int, maxRows);

  // v3.89: DATEADD(HOUR, -7, ...) sua loi gio hien thi lech 7 gio (mssql/tedious hieu nham
  // GETDATE() gio VN la UTC luc doc ve) - xem ghi chu chi tiet o scanLogService.js. Khong dong
  // den WHERE/ORDER ben duoi (van loc/sap xep theo Created_Date GOC, dung nhu truoc).
  const result = await request.query(`
      SELECT ${topClause}
        vs.User_Name, vs.TRANS_NUM, vs.Voucher_Serial, vs.Voucher_Code,
        DATEADD(HOUR, -7, vs.Created_Date) AS Created_Date,
        vs.Locations_Detail, vs.Location_DetailName, vs.VALUE_AMT, vs.Sync,
        ru.PartnerName, ru.CompanyId, rc.CompanyName, vri.InvoiceNumber
      FROM dbo.VOUCHER_SYNC vs
      LEFT JOIN (
        -- M8: khi 1 LocationCode bi trung nhieu dong (du lieu Locations_Detail dung chung voi
        -- Core), truoc day chon dai dien "dau tien theo id" bat ke dong do co duoc gan Don vi
        -- thu hoi/Cong ty hay khong - neu dong duoc chon lai khong co anh xa, voucher se hien
        -- "chua gan cong ty" du that ra 1 dong trung khac CO gan. Uu tien dong DA CO anh xa
        -- RedemptionUnits truoc (CASE 0 truoc 1), chi lay dong khong co anh xa khi khong con
        -- lua chon nao khac.
        SELECT id, LTRIM(RTRIM(LocationCode)) AS LocationCode,
          ROW_NUMBER() OVER (
            PARTITION BY LTRIM(RTRIM(LocationCode))
            ORDER BY CASE WHEN EXISTS (SELECT 1 FROM dbo.RedemptionUnits ru0 WHERE ru0.LocationDetailId = d.id) THEN 0 ELSE 1 END, id
          ) AS rn
        FROM dbo.Locations_Detail d
      ) ld ON ld.LocationCode = LTRIM(RTRIM(vs.Locations_Detail)) AND ld.rn = 1
      LEFT JOIN dbo.RedemptionUnits ru ON ru.LocationDetailId = ld.id
      LEFT JOIN dbo.RedemptionCompanies rc ON rc.Id = ru.CompanyId
      LEFT JOIN dbo.VoucherRedemptionConnections vrc ON vrc.TransNum = vs.TRANS_NUM
      LEFT JOIN dbo.VoucherRedemptionInvoices vri ON vri.TransNum = vs.TRANS_NUM
      WHERE CAST(vs.Created_Date AS DATE) BETWEEN @fromDate AND @toDate${locationFilter}${extraFilter}
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
    const locationName = row.Location_DetailName || row.Locations_Detail || '-';
    if (!company.pointMap.has(pointName)) {
      company.pointMap.set(pointName, { pointName, locationName, rows: [], count: 0, amount: 0 });
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
      invoiceNumber: row.InvoiceNumber || null,
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

// L1: xem giai thich day du o usedVoucherReportService.js.
const FORMULA_PREFIX_REGEX = /^[=+\-@\t\r]/;
function sanitizeExcelText(value) {
  if (value === null || value === undefined) return value;
  const str = String(value);
  return FORMULA_PREFIX_REGEX.test(str) ? `'${str}` : str;
}

/**
 * Xuat Bao cao tong hop ra Excel - 2 sheet: "Tong hop theo cong ty-diem" (cong don giong cac
 * dong Cong ty/Diem tieu tren man hinh) va "Chi tiet giao dich" (PHANG, 1 dong/giao dich, kem
 * ten cong ty/diem tieu o moi dong de de loc/pivot trong Excel).
 */
async function buildSummaryExcelBuffer({ companies, grandTotal }) {
  const workbook = new ExcelJS.Workbook();

  const summarySheet = workbook.addWorksheet('Tong hop theo cong ty-diem');
  summarySheet.columns = [
    { header: 'Cong ty', key: 'companyName', width: 28 },
    { header: 'Dia diem', key: 'locationName', width: 28 },
    { header: 'Diem tieu', key: 'pointName', width: 28 },
    { header: 'So voucher', key: 'count', width: 14 },
    { header: 'Menh gia', key: 'amount', width: 16 },
  ];
  summarySheet.getRow(1).font = { bold: true };
  companies.forEach((company) => {
    summarySheet.addRow({
      companyName: sanitizeExcelText(company.companyName),
      locationName: '',
      pointName: '',
      count: company.count,
      amount: company.amount,
    });
    company.points.forEach((point) => {
      summarySheet.addRow({
        companyName: '',
        locationName: sanitizeExcelText(point.locationName),
        pointName: sanitizeExcelText(point.pointName),
        count: point.count,
        amount: point.amount,
      });
    });
  });
  const summaryTotalRow = summarySheet.addRow({
    companyName: 'TONG TOAN BO CONG TY',
    locationName: '',
    pointName: '',
    count: grandTotal.count,
    amount: grandTotal.amount,
  });
  summaryTotalRow.font = { bold: true };
  summarySheet.getColumn('amount').numFmt = '#,##0';

  const detailSheet = workbook.addWorksheet('Chi tiet giao dich');
  detailSheet.columns = [
    { header: 'Cong ty', key: 'companyName', width: 28 },
    { header: 'Dia diem', key: 'locationName', width: 28 },
    { header: 'Diem tieu', key: 'pointName', width: 28 },
    { header: 'Ngay tieu', key: 'createdDate', width: 20 },
    { header: 'Nguoi tieu', key: 'userName', width: 24 },
    { header: 'Ma giao dich', key: 'transNum', width: 22 },
    { header: 'Ma voucher', key: 'voucherCode', width: 18 },
    { header: 'Serial', key: 'voucherSerial', width: 18 },
    { header: 'Menh gia', key: 'valueAmt', width: 14 },
    { header: 'Dong bo', key: 'syncedLabel', width: 14 },
    { header: 'So hoa don', key: 'invoiceNumber', width: 18 },
  ];
  detailSheet.getRow(1).font = { bold: true };
  companies.forEach((company) => {
    company.points.forEach((point) => {
      point.rows.forEach((row) => {
        detailSheet.addRow({
          companyName: sanitizeExcelText(company.companyName),
          locationName: sanitizeExcelText(point.locationName),
          pointName: sanitizeExcelText(point.pointName),
          createdDate: row.createdDate ? new Date(row.createdDate) : null,
          userName: sanitizeExcelText(row.userName),
          transNum: sanitizeExcelText(row.transNum),
          voucherCode: sanitizeExcelText(row.voucherCode),
          voucherSerial: sanitizeExcelText(row.voucherSerial),
          valueAmt: row.valueAmt,
          syncedLabel: row.synced ? 'Da dong bo' : 'Cho dong bo',
          invoiceNumber: sanitizeExcelText(row.invoiceNumber || '-'),
        });
      });
    });
  });
  detailSheet.getColumn('createdDate').numFmt = 'dd/mm/yyyy hh:mm';
  detailSheet.getColumn('valueAmt').numFmt = '#,##0';

  return workbook.xlsx.writeBuffer();
}

module.exports = { consolidatedReport, buildSummaryExcelBuffer, MAX_EXPORT_ROWS };
