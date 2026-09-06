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

async function daily(req, res, next) {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const locationsDetail = req.query.locationsDetail || null;
    const { codes } = await resolveScope(req);
    const data = await reportService.dailyReconciliation({ date, locationsDetail, visibleLocationCodes: codes });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function summary(req, res, next) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const fromDate = req.query.fromDate || today;
    const toDate = req.query.toDate || today;
    if (fromDate > toDate) {
      return res.status(400).json({ success: false, message: 'Ngay bat dau phai truoc hoac bang ngay ket thuc' });
    }
    const { codes } = await resolveScope(req);
    const data = await summaryReportService.consolidatedReport({ fromDate, toDate, visibleLocationCodes: codes });
    res.json({ success: true, data });
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
    const { codes } = await resolveScope(req);
    const data = await usedVoucherReportService.listUsedVouchers({ fromDate, toDate, visibleLocationCodes: codes });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function usedVouchersExport(req, res, next) {
  try {
    const { fromDate, toDate } = parseDateRange(req.query);
    const { codes } = await resolveScope(req);
    const rows = await usedVoucherReportService.listUsedVouchers({ fromDate, toDate, visibleLocationCodes: codes });
    const buffer = await usedVoucherReportService.buildExcelBuffer(rows);

    const fileName = `voucher-da-su-dung_${fromDate || 'toanbo'}_${toDate || 'toanbo'}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}

module.exports = { daily, summary, usedVouchers, usedVouchersExport };
