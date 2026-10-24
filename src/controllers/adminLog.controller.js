const auditLogService = require('../services/auditLogService');
const scanLogService = require('../services/scanLogService');

async function auditLog(req, res, next) {
  try {
    const data = await auditLogService.list({
      fromDate: req.query.fromDate || null,
      toDate: req.query.toDate || null,
      limit: req.query.limit,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function auditLogExport(req, res, next) {
  try {
    const fromDate = req.query.fromDate || null;
    const toDate = req.query.toDate || null;
    const rows = await auditLogService.list({ fromDate, toDate, limit: auditLogService.MAX_EXPORT_ROWS });
    const buffer = await auditLogService.buildExcelBuffer(rows);
    const fileName = `nhat-ky-quan-tri_${fromDate || 'toanbo'}_${toDate || 'toanbo'}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(Buffer.from(buffer));
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

async function scanLogExport(req, res, next) {
  try {
    const fromDate = req.query.fromDate || null;
    const toDate = req.query.toDate || null;
    const rows = await scanLogService.list({ fromDate, toDate, limit: scanLogService.MAX_EXPORT_ROWS });
    const buffer = await scanLogService.buildExcelBuffer(rows);
    const fileName = `hoat-dong-quet-thu-hoi_${fromDate || 'toanbo'}_${toDate || 'toanbo'}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}

module.exports = { auditLog, auditLogExport, scanLog, scanLogExport };
