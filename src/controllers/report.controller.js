const reportService = require('../services/reportService');

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

module.exports = { daily };
