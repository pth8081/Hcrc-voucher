const reportService = require('../services/reportService');
const summaryReportService = require('../services/summaryReportService');
const usedVoucherReportService = require('../services/usedVoucherReportService');
const reportAccessService = require('../services/reportAccessService');

async function resolveScope(req) {
  return reportAccessService.resolveVisibleLocationCodes({
    userId: req.user.userId,
    ownLocationsDetail: req.user.locationsDetail,
    role: req.user.role,
  });
}

/** Doc 3 tham so loc chung "Cong ty thu / Diem thu hoi / Tai khoan thu hoi" dung cho ca 4 bao
 * cao (doi soat, tong hop, danh sach va xuat Excel voucher da su dung). */
function parseExtraFilters(query) {
  return {
    companyId: query.companyId ? Number(query.companyId) : null,
    redemptionUnitId: query.redemptionUnitId ? Number(query.redemptionUnitId) : null,
    userId: query.userId ? Number(query.userId) : null,
  };
}

async function daily(req, res, next) {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const locationsDetail = req.query.locationsDetail || null;
    const { codes, unassigned } = await resolveScope(req);
    const data = await reportService.dailyReconciliation({
      date,
      locationsDetail,
      visibleLocationCodes: codes,
      ...parseExtraFilters(req.query),
    });
    res.json({ success: true, data: { ...data, unassignedLocation: !!unassigned } });
  } catch (err) {
    next(err);
  }
}

// M9: bao cao tong hop truoc day khong gioi han do rong khoang ngay - 1 khoang ngay qua lon
// (nhieu nam) khien truy van cong don (GROUP BY theo Cong ty -> Diem tieu) qua nhieu du lieu,
// rui ro cham/qua tai server tuong tu loi da vua sua o danh sach voucher da su dung (H11).
const MAX_SUMMARY_RANGE_DAYS = 366;

async function summary(req, res, next) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const fromDate = req.query.fromDate || today;
    const toDate = req.query.toDate || today;
    if (fromDate > toDate) {
      return res.status(400).json({ success: false, message: 'Ngay bat dau phai truoc hoac bang ngay ket thuc' });
    }
    const rangeDays = (new Date(toDate) - new Date(fromDate)) / (24 * 60 * 60 * 1000);
    if (rangeDays > MAX_SUMMARY_RANGE_DAYS) {
      return res.status(400).json({
        success: false,
        message: `Khoang ngay toi da ${MAX_SUMMARY_RANGE_DAYS} ngay cho bao cao tong hop, vui long chon khoang ngay hep hon`,
      });
    }
    const { codes, unassigned } = await resolveScope(req);
    const data = await summaryReportService.consolidatedReport({
      fromDate,
      toDate,
      visibleLocationCodes: codes,
      ...parseExtraFilters(req.query),
    });
    res.json({ success: true, data: { ...data, unassignedLocation: !!unassigned } });
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
    const rows = await usedVoucherReportService.listUsedVouchers({
      fromDate,
      toDate,
      visibleLocationCodes: codes,
      ...parseExtraFilters(req.query),
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

async function filterRedeemers(req, res, next) {
  try {
    const { codes } = await resolveScope(req);
    const redeemers = await reportService.listFilterRedeemers(codes);
    res.json({ success: true, data: redeemers });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  daily,
  summary,
  usedVouchers,
  usedVouchersExport,
  filterCompanies,
  filterRedemptionUnits,
  filterRedeemers,
};
