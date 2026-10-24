const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const controller = require('../controllers/adminLog.controller');

const router = express.Router();
router.use(authenticate, requireAdmin);

router.get('/audit-log', controller.auditLog);
router.get('/audit-log/export', controller.auditLogExport);
router.get('/scan-log', controller.scanLog);
router.get('/scan-log/export', controller.scanLogExport);

module.exports = router;
