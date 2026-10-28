const reportService = require('../services/reportService');
const summaryReportService = require('../services/summaryReportService');
const usedVoucherReportService = require('../services/usedVoucherReportService');
const reportAccessService = require('../services/reportAccessService');
const apiConnectionService = require('../services/apiConnectionService');
const userVoucherSystemService = require('../services/userVoucherSystemService');
const redemptionUnitService = require('../services/redemptionUnitService');

async function resolveScope(req) {
  return reportAccessService.resolveVisibleLocationCodes({
    userId: req.user.userId,
    ownLocationsDetail: req.user.locationsDetail,
    role: req.user.role,
  });
}

/**
 * Tinh danh sach he thong voucher (connectionIds) DUOC PHEP xem trong bao cao - KET HOP gioi
 * han theo tai khoan (userVoucherSystemService.js, vd tai khoan doi soat cua Fuji chi duoc xem
 * Fuji) VA lua chon o loc "He thong" tren man hinh (neu co). Day la bo loc BAT BUOC (khong chi
 * tuy chon nhu Cong ty/Diem/Tai khoan) - 1 tai khoan bi gioi han KHONG the bo qua bang cach
 * khong chon gi hoac sua query string, vi luon duoc tinh lai o server theo dung quyen that su.
 *
 * M13 (loi that da bao cao): muc 12e (v3.51) da sua de du lieu CU (vrc.ConnectionId = NULL,
 * truoc khi co tinh nang nhieu he thong) khong bi "mat tich" khoi bao cao doi voi tai khoan BI
 * GIOI HAN he thong - nhung ban sua do ap dung NULL-tolerance ca khi nguoi dung TU CHON 1 he
 * thong cu the o o loc "He thong voucher" tren man hinh, khien chon loc "Fuji" lai LAN ca du
 * lieu CU chua gan he thong nao (thuc chat la cua HCRC/khong ro) vao - sai, gay hieu nham day la
 * du lieu Fuji that. Tra ve them co `includeUntagged`: CHI true khi connectionIds den tu GIOI
 * HAN TAI KHOAN (bat buoc, khong co lua chon UI ro rang) - false (so khop CHINH XAC, khong lan
 * du lieu chua gan he thong) khi nguoi dung DA TU CHON 1 he thong cu the qua o loc.
 *
 * M15 (theo yeu cau): v3.51/v3.53 o tren mac dinh LUON cho tai khoan bi gioi han he thong thay
 * du lieu cu (khong co cach nao tat di) - nay doi thanh TUY CHON, dieu khien boi 1 "he thong ao"
 * rieng trong UserVoucherSystems (UNTAGGED_CONNECTION_ID, tick "Khac" o man Tai khoan). Tach
 * rieng gia tri ao nay khoi danh sach connectionId THAT (dung de loc vrc.ConnectionId IN (...)) -
 * `includeUntagged` gio = true CHI KHI tai khoan DUOC TICK "Khac" (khong con tu dong true moi
 * khi bi gioi han nhu truoc).
 */
async function resolveConnectionFilter(req) {
  const allowed = await userVoucherSystemService.getAllowedConnectionIds(req.user.userId);
  const requested = req.query.connectionId ? Number(req.query.connectionId) : null;
  if (requested) {
    if (allowed !== null && !allowed.includes(requested)) return { ids: [], includeUntagged: false };
    return { ids: [requested], includeUntagged: false };
  }
  if (allowed === null) return { ids: null, includeUntagged: false };
  const includeUntagged = allowed.includes(userVoucherSystemService.UNTAGGED_CONNECTION_ID);
  const ids = allowed.filter((id) => id !== userVoucherSystemService.UNTAGGED_CONNECTION_ID);
  return { ids, includeUntagged };
}

/** v3.96: "Diem thu hoi" o 3 man bao cao xem truc tiep doi tu chon 1 sang tick chon NHIEU diem
 * (giong ben Lich gui email) - query string truyen vao dang nhieu id cach nhau dau phay (vd
 * "3,7,12", xem reportFilters.js#getReportFilterParams). Tra null neu khong co id hop le nao
 * (giu nguyen hanh vi cu "khong loc"). Cac ham build bao cao (reportService.js/
 * summaryReportService.js/usedVoucherReportService.js) da ho tro nhan mang tu truoc (muc 18,
 * v3.95 - lam cho Lich gui email), nen o day chi can tra ve mang la tai dung lai duoc ngay. */
function parseIdListParam(raw) {
  if (!raw) return null;
  const ids = String(raw)
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return ids.length ? ids : null;
}

/** Doc 3 tham so loc chung "Cong ty thu / Diem thu hoi / Tai khoan thu hoi" dung cho ca 4 bao
 * cao (doi soat, tong hop, danh sach va xuat Excel voucher da su dung). redemptionUnitId gio la
 * MANG (hoac null) - xem parseIdListParam. */
function parseExtraFilters(query) {
  return {
    companyId: query.companyId ? Number(query.companyId) : null,
    redemptionUnitId: parseIdListParam(query.redemptionUnitId),
    userId: query.userId ? Number(query.userId) : null,
  };
}

// M9: bao cao tong hop/doi soat truoc day khong gioi han do rong khoang ngay - 1 khoang ngay qua
// lon (nhieu nam) khien truy van cong don qua nhieu du lieu, rui ro cham/qua tai server tuong tu
// loi da vua sua o danh sach voucher da su dung (H11). Dung chung 1 gioi han cho ca 2 bao cao.
const MAX_SUMMARY_RANGE_DAYS = 366;

/** Doc fromDate/toDate tu query, mac dinh hom nay neu thieu, kiem tra thu tu + gioi han do rong
 * khoang ngay - dung chung cho ca Bao cao doi soat va Bao cao tong hop (cung 1 quy tac). */
function parseBoundedDateRange(query, rangeLabel) {
  const today = new Date().toISOString().slice(0, 10);
  const fromDate = query.fromDate || today;
  const toDate = query.toDate || today;
  if (fromDate > toDate) {
    const err = new Error('Ngay bat dau phai truoc hoac bang ngay ket thuc');
    err.statusCode = 400;
    err.publicMessage = err.message;
    throw err;
  }
  const rangeDays = (new Date(toDate) - new Date(fromDate)) / (24 * 60 * 60 * 1000);
  if (rangeDays > MAX_SUMMARY_RANGE_DAYS) {
    const err = new Error('Khoang ngay qua rong');
    err.statusCode = 400;
    err.publicMessage = `Khoang ngay toi da ${MAX_SUMMARY_RANGE_DAYS} ngay cho ${rangeLabel}, vui long chon khoang ngay hep hon`;
    throw err;
  }
  return { fromDate, toDate };
}

async function daily(req, res, next) {
  try {
    const { fromDate, toDate } = parseBoundedDateRange(req.query, 'bao cao doi soat');
    const locationsDetail = req.query.locationsDetail || null;
    const { codes, unassigned } = await resolveScope(req);
    const { ids: connectionIds, includeUntagged: includeUntaggedConnections } = await resolveConnectionFilter(req);
    const data = await reportService.dailyReconciliation({
      fromDate,
      toDate,
      locationsDetail,
      visibleLocationCodes: codes,
      ...parseExtraFilters(req.query),
      connectionIds,
      includeUntaggedConnections,
    });
    res.json({ success: true, data: { ...data, unassignedLocation: !!unassigned } });
  } catch (err) {
    next(err);
  }
}

async function dailyExport(req, res, next) {
  try {
    const { fromDate, toDate } = parseBoundedDateRange(req.query, 'bao cao doi soat');
    const locationsDetail = req.query.locationsDetail || null;
    const { codes } = await resolveScope(req);
    const { ids: connectionIds, includeUntagged: includeUntaggedConnections } = await resolveConnectionFilter(req);
    const { summary, details } = await reportService.dailyReconciliation({
      fromDate,
      toDate,
      locationsDetail,
      visibleLocationCodes: codes,
      ...parseExtraFilters(req.query),
      connectionIds,
      includeUntaggedConnections,
      maxDetailRows: reportService.MAX_EXPORT_ROWS,
    });
    const buffer = await reportService.buildReconciliationExcelBuffer({ summary, details });

    const fileName = `bao-cao-doi-soat_${fromDate}_${toDate}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}

async function summary(req, res, next) {
  try {
    const { fromDate, toDate } = parseBoundedDateRange(req.query, 'bao cao tong hop');
    const { codes, unassigned } = await resolveScope(req);
    const { ids: connectionIds, includeUntagged: includeUntaggedConnections } = await resolveConnectionFilter(req);
    const data = await summaryReportService.consolidatedReport({
      fromDate,
      toDate,
      visibleLocationCodes: codes,
      ...parseExtraFilters(req.query),
      connectionIds,
      includeUntaggedConnections,
    });
    res.json({ success: true, data: { ...data, unassignedLocation: !!unassigned } });
  } catch (err) {
    next(err);
  }
}

async function summaryExport(req, res, next) {
  try {
    const { fromDate, toDate } = parseBoundedDateRange(req.query, 'bao cao tong hop');
    const { codes } = await resolveScope(req);
    const { ids: connectionIds, includeUntagged: includeUntaggedConnections } = await resolveConnectionFilter(req);
    const data = await summaryReportService.consolidatedReport({
      fromDate,
      toDate,
      visibleLocationCodes: codes,
      ...parseExtraFilters(req.query),
      connectionIds,
      includeUntaggedConnections,
      maxRows: summaryReportService.MAX_EXPORT_ROWS,
    });
    const buffer = await summaryReportService.buildSummaryExcelBuffer(data);

    const fileName = `bao-cao-tong-hop_${fromDate}_${toDate}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}

function parseDateRange(query) {
  const fromDate = query.fromDate || null;
  const toDate = query.toDate || null;
  if (fromDate && toDate && fromDate > toDate) {
    const err = new Error('Ngay bat dau phai truoc hoac bang ngay ket thuc');
    err.statusCode = 400;
    err.publicMessage = err.message;
    throw err;
  }
  return { fromDate, toDate };
}

async function usedVouchers(req, res, next) {
  try {
    const { fromDate, toDate } = parseDateRange(req.query);
    const { codes, unassigned } = await resolveScope(req);
    const { ids: connectionIds, includeUntagged: includeUntaggedConnections } = await resolveConnectionFilter(req);
    // H11: truoc day khong gioi han gi ca - goi khong tham so co the keo ve toan bo lich su
    // nhieu nam roi render thang vao 1 bang HTML, rui ro treo trinh duyet/qua tai server. Xem
    // MAX_LIST_ROWS trong usedVoucherReportService.js. `truncated` bao cho giao dien biet de
    // nhac nguoi dung thu hep khoang ngay/dung Xuat Excel neu can day du hon.
    // Lay THUA 1 dong so voi gioi han hien thi that su: cach duy nhat de biet CHAC CHAN co bi cat
    // bot hay khong (truoc day dung ">=" ngay tren gioi han truy van, nen khi ket qua THAT SU chi
    // co dung MAX_LIST_ROWS dong (khong thua) van bao "truncated=true" sai - da bi 1 dot ra soat
    // sau phat hien). Neu du thua 1 dong, cat bot lai dung MAX_LIST_ROWS truoc khi tra ve.
    const maxRows = usedVoucherReportService.MAX_LIST_ROWS;
    const rows = await usedVoucherReportService.listUsedVouchers({
      fromDate,
      toDate,
      visibleLocationCodes: codes,
      ...parseExtraFilters(req.query),
      connectionIds,
      includeUntaggedConnections,
      invoiceNumber: req.query.invoiceNumber ? String(req.query.invoiceNumber).trim().slice(0, 50) : null,
      maxRows: maxRows + 1,
    });
    const truncated = rows.length > maxRows;
    const limitedRows = truncated ? rows.slice(0, maxRows) : rows;
    res.json({ success: true, data: { rows: limitedRows, unassignedLocation: !!unassigned, truncated } });
  } catch (err) {
    next(err);
  }
}

async function usedVouchersExport(req, res, next) {
  try {
    const { fromDate, toDate } = parseDateRange(req.query);
    if (!fromDate && !toDate) {
      const err = new Error(`Vui long chon khoang ngay truoc khi xuat Excel (toi da ${usedVoucherReportService.MAX_EXPORT_ROWS.toLocaleString('vi-VN')} dong moi lan xuat)`);
      err.statusCode = 400;
      err.publicMessage = err.message;
      throw err;
    }
    const { codes } = await resolveScope(req);
    const { ids: connectionIds, includeUntagged: includeUntaggedConnections } = await resolveConnectionFilter(req);
    const rows = await usedVoucherReportService.listUsedVouchers({
      fromDate,
      toDate,
      visibleLocationCodes: codes,
      ...parseExtraFilters(req.query),
      connectionIds,
      includeUntaggedConnections,
      invoiceNumber: req.query.invoiceNumber ? String(req.query.invoiceNumber).trim().slice(0, 50) : null,
      maxRows: usedVoucherReportService.MAX_EXPORT_ROWS,
    });
    const buffer = await usedVoucherReportService.buildExcelBuffer(rows);

    const fileName = `voucher-da-su-dung_${fromDate || 'toanbo'}_${toDate || 'toanbo'}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}

// Danh sach gia tri cho 3 o loc "Cong ty thu / Diem thu hoi / Tai khoan thu hoi" - dung chung
// cho ca 3 man hinh bao cao. Khong dung lai /companies, /redemption-units (requireAdmin) vi
// nhan vien (khong phai admin) van can xem duoc cac o loc nay tren man hinh bao cao cua ho -
// scope theo cung 1 visibleLocationCodes nhu du lieu bao cao chinh, tranh lo thong tin cong
// ty/diem tieu ngoai quyen xem cua nhan vien do.
async function filterCompanies(req, res, next) {
  try {
    const { codes } = await resolveScope(req);
    const companies = await reportService.listFilterCompanies(codes);
    res.json({ success: true, data: companies });
  } catch (err) {
    next(err);
  }
}

async function filterRedemptionUnits(req, res, next) {
  try {
    const { codes } = await resolveScope(req);
    const companyId = req.query.companyId ? Number(req.query.companyId) : null;
    const units = await reportService.listFilterRedemptionUnits(codes, companyId);
    res.json({ success: true, data: units });
  } catch (err) {
    next(err);
  }
}

/** Diem thu hoi (redemptionUnitId) dang chon, neu co -> tra ve mang LocationCode cua cac diem do
 * de loc tiep o filterRedeemers/filterSystems. Dung chung, tra null neu khong truyen/khong ton
 * tai (bo qua loc them, giu nguyen hanh vi cu - khong nem loi vi day chi la 1 o loc tuy chon).
 * v3.96: doi tu 1 id sang MANG id (tick chon nhieu diem). */
async function resolveFilterLocationCodes(req) {
  const redemptionUnitIds = parseIdListParam(req.query.redemptionUnitId);
  if (!redemptionUnitIds) return null;
  const codes = await Promise.all(redemptionUnitIds.map((id) => redemptionUnitService.getLocationCodeById(id)));
  const validCodes = codes.filter(Boolean);
  return validCodes.length ? validCodes : null;
}

/** M11: nhan them redemptionUnitId (tuy chon, tu o chon "Diem thu hoi" dang chon tren man hinh
 * bao cao - v3.96: co the la NHIEU diem) de loc danh sach CHI con cac tai khoan DANG gan 1 trong
 * cac diem do - xem reportService.js#listFilterRedeemers. */
async function filterRedeemers(req, res, next) {
  try {
    const { codes } = await resolveScope(req);
    const locationCodes = await resolveFilterLocationCodes(req);
    const redeemers = await reportService.listFilterRedeemers(codes, locationCodes);
    res.json({ success: true, data: redeemers });
  } catch (err) {
    next(err);
  }
}

/** Danh sach he thong voucher de hien thi o loc "He thong" - CHI gom cac he thong tai khoan nay
 * duoc phep xem (userVoucherSystemService.js), giong het bo loc thuc te se bi ap dung khi xem
 * bao cao (resolveConnectionFilter). 1 tai khoan bi gioi han CHI Fuji se chi thay "Fuji" o day.
 * M11: neu co chon them "Diem thu hoi" (redemptionUnitId, v3.96: co the NHIEU diem), loc tiep CHI
 * con he thong duoc IT NHAT 1 tai khoan dang gan 1 trong cac diem do duoc phep dung
 * (userVoucherSystemService.js#getAllowedConnectionIdsForLocations) - giao voi quyen cua chinh
 * tai khoan dang xem bao cao (khong bao gio hien thi vuot qua quyen cua nguoi dang xem, du diem
 * do co tai khoan duoc dung he thong rong hon). */
async function filterSystems(req, res, next) {
  try {
    const [all, allowed] = await Promise.all([
      apiConnectionService.listOptions(),
      userVoucherSystemService.getAllowedConnectionIds(req.user.userId),
    ]);
    let data = allowed === null ? all : all.filter((c) => allowed.includes(c.id));

    const locationCodes = await resolveFilterLocationCodes(req);
    if (locationCodes) {
      const unitAllowed = await userVoucherSystemService.getAllowedConnectionIdsForLocations(locationCodes);
      if (unitAllowed !== null) data = data.filter((c) => unitAllowed.includes(c.id));
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  daily,
  dailyExport,
  summary,
  summaryExport,
  usedVouchers,
  usedVouchersExport,
  filterCompanies,
  filterRedemptionUnits,
  filterRedeemers,
  filterSystems,
};
