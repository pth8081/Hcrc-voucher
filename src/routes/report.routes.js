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

// Danh sach gia tri cho o loc Cong ty/Diem thu hoi/Tai khoan thu hoi - dung chung tren ca 3 man
// hinh bao cao, nen cho phep bat ky nguoi dung co quyen xem it nhat 1 trong 3 bao cao goi duoc
// (khong rieng 1 quyen nao) thay vi them 1 requireFeature moi.
router.get(
  '/filters/companies',
  requireFeature(['canViewReconciliation', 'canViewSummary', 'canViewUsedVouchers']),
  controller.filterCompanies
);
router.get(
  '/filters/redemption-units',
  requireFeature(['canViewReconciliation', 'canViewSummary', 'canViewUsedVouchers']),
  controller.filterRedemptionUnits
);
router.get(
  '/filters/redeemers',
  requireFeature(['canViewReconciliation', 'canViewSummary', 'canViewUsedVouchers']),
  controller.filterRedeemers
);
router.get(
  '/filters/systems',
  requireFeature(['canViewReconciliation', 'canViewSummary', 'canViewUsedVouchers']),
  controller.filterSystems
);

module.exports = router;
