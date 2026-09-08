const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireFeature } = require('../middleware/requireFeature');
const controller = require('../controllers/report.controller');

const router = express.Router();
router.use(authenticate);
router.get('/daily', requireFeature('canViewReconciliation'), controller.daily);
router.get('/summary', requireFeature('canViewSummary'), controller.summary);
router.get('/used-vouchers', requireFeature('canViewUsedVouchers'), controller.usedVouchers);
router.get('/used-vouchers/export', requireFeature('canViewUsedVouchers'), controller.usedVouchersExport);

module.exports = router;
