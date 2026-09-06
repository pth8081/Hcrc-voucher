const express = require('express');
const { authenticate } = require('../middleware/auth');
const controller = require('../controllers/report.controller');

const router = express.Router();
router.use(authenticate);
router.get('/daily', controller.daily);
router.get('/summary', controller.summary);
router.get('/used-vouchers', controller.usedVouchers);
router.get('/used-vouchers/export', controller.usedVouchersExport);

module.exports = router;
