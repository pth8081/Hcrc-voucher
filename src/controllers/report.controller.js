const reportService = require('../services/reportService');
const summaryReportService = require('../services/summaryReportService');

async function daily(req, res, next) {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const locationsDetail = req.query.locationsDetail || null;
    const data = await reportService.dailyReconciliation({ date, locationsDetail });
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
    const data = await summaryReportService.consolidatedReport({ fromDate, toDate });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { daily, summary };
