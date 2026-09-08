const auditLogService = require('../services/auditLogService');
const scanLogService = require('../services/scanLogService');

async function auditLog(req, res, next) {
  try {
    const data = await auditLogService.list({ limit: req.query.limit });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function scanLog(req, res, next) {
  try {
    const data = await scanLogService.list({
      fromDate: req.query.fromDate || null,
      toDate: req.query.toDate || null,
      limit: req.query.limit,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { auditLog, scanLog };
