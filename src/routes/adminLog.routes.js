const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireAdmin, requireAdminFeature } = require('../middleware/requireRole');
const controller = require('../controllers/adminLog.controller');

const router = express.Router();
// Toan bo man hinh "Nhat ky he thong" (public/admin-log.html) - khong co man nao khac goi API nay.
router.use(authenticate, requireAdmin, requireAdminFeature('adminCanViewAdminLog'));

router.get('/audit-log', controller.auditLog);
router.get('/audit-log/export', controller.auditLogExport);
router.get('/scan-log', controller.scanLog);
router.get('/scan-log/export', controller.scanLogExport);

module.exports = router;
