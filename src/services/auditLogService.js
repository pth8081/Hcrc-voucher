const ExcelJS = require('exceljs');
const { sql, getPool } = require('../config/db');

/**
 * Ghi 1 dong nhat ky thao tac QUAN TRI - khong bao gio throw ra ngoai (log that bai khong
 * duoc lam hong thao tac chinh dang thuc hien), chi in loi ra console de biet neu co su co.
 *
 * L6: quy uoc cho `detail` - LUON la { before, after } (before=null cho thao tac TAO moi,
 * after=null cho thao tac XOA) thay vi chi ghi gia tri MOI nhu truoc day - de biet duoc CHINH
 * XAC gia tri THAY DOI TU DAU, khong chi "gia tri sau cung la gi" (quan trong khi dieu tra 1
 * thay doi bat thuong: ai da doi TU gia tri nao). KHONG BAO GIO dua mat khau/secret (du da ma
 * hoa) vao day - cac controller da tu loc bo cac truong nay truoc khi goi ham nay.
 */
async function log({ actorUsername, action, targetUsername, detail }) {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input('actor', sql.NVarChar(100), actorUsername || null)
      .input('action', sql.NVarChar(100), action)
      .input('target', sql.NVarChar(100), targetUsername || null)
      .input('detail', sql.NVarChar(sql.MAX), detail ? JSON.stringify(detail) : null)
      .query(`
        INSERT INTO dbo.AdminAuditLog (ActorUsername, Action, TargetUsername, Detail, CreatedDate)
        VALUES (@actor, @action, @target, @detail, GETDATE())
      `);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Ghi AdminAuditLog that bai:', err.message);
  }
}

// Gioi han so dong toi da khi XUAT Excel (muc 15c) - rong hon nhieu so GIOI HAN HIEN THI mac
// dinh tren man hinh (1000, xem `list()`), giong quy uoc MAX_EXPORT_ROWS da dung o cac bao cao
// khac (reportService.js) - nguoi dung can "bao cao dai ngay" de doi soat van xuat duoc du lieu,
// chi man hinh xem truc tiep moi can gioi han chat de tai nhanh.
const MAX_EXPORT_ROWS = 50000;

/** fromDate/toDate (tuy chon): loc theo CreatedDate, dung CHUNG 1 quy uoc voi scanLogService.js#list
 * de 2 tab dung 1 kieu bo loc nhat quan. */
async function list({ fromDate, toDate, limit }) {
  const pool = await getPool();
  // Dot ra soat sau phat hien: truoc day chi gioi han CAN TREN - 1 gia tri am (vd ?limit=-1)
  // van "truthy" nen vuot qua "|| 200", roi lam SELECT TOP (@limit) bao loi SQL. Ep ve khoang
  // [1, 1000] ro rang thay vi chi chan tren.
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 1000);
  const request = pool.request().input('limit', sql.Int, safeLimit);

  let filter = '1 = 1';
  if (fromDate) {
    request.input('fromDate', sql.Date, fromDate);
    filter += ' AND CAST(CreatedDate AS DATE) >= @fromDate';
  }
  if (toDate) {
    request.input('toDate', sql.Date, toDate);
    filter += ' AND CAST(CreatedDate AS DATE) <= @toDate';
  }

  const result = await request.query(`
    SELECT TOP (@limit) Id, ActorUsername, Action, TargetUsername, Detail, CreatedDate
    FROM dbo.AdminAuditLog
    WHERE ${filter}
    ORDER BY CreatedDate DESC
  `);
  return result.recordset;
}

// L1 (xem giai thich day du o usedVoucherReportService.js): them dau nhay don o dau chuoi NEU
// bat dau bang =/+/-/@ de ep hien thi nhu van ban thuan tuy, tranh 1 so trinh xem file dien giai
// nham thanh cong thuc (CSV/formula injection).
const FORMULA_PREFIX_REGEX = /^[=+\-@\t\r]/;
function sanitizeExcelText(value) {
  if (value === null || value === undefined) return value;
  const str = String(value);
  return FORMULA_PREFIX_REGEX.test(str) ? `'${str}` : str;
}

function detailText(raw) {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw));
  } catch (err) {
    return raw;
  }
}

async function buildExcelBuffer(rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Nhat ky quan tri');
  sheet.columns = [
    { header: 'Thoi gian', key: 'createdDate', width: 20 },
    { header: 'Nguoi thuc hien', key: 'actor', width: 20 },
    { header: 'Hanh dong', key: 'action', width: 24 },
    { header: 'Doi tuong', key: 'target', width: 24 },
    { header: 'Chi tiet', key: 'detail', width: 60 },
  ];
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => {
    sheet.addRow({
      createdDate: row.CreatedDate ? new Date(row.CreatedDate) : null,
      actor: sanitizeExcelText(row.ActorUsername),
      action: sanitizeExcelText(row.Action),
      target: sanitizeExcelText(row.TargetUsername),
      detail: sanitizeExcelText(detailText(row.Detail)),
    });
  });
  sheet.getColumn('createdDate').numFmt = 'dd/mm/yyyy hh:mm:ss';
  return workbook.xlsx.writeBuffer();
}

module.exports = { log, list, buildExcelBuffer, MAX_EXPORT_ROWS };
