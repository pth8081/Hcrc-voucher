const express = require('express');
const controller = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth');
const { requireAdmin, requireAdminFeature } = require('../middleware/requireRole');

const router = express.Router();
// Toan bo man hinh "Tai khoan" (public/users.html) - khong co man nao khac goi API nay (xem
// khao sat truoc khi them M20) nen gan CA ROUTER qua adminCanManageUsers la an toan, khong lam
// gay dropdown/du lieu tham chieu cua man hinh khac (khac voi company/redemptionUnit/... can tach
// rieng GET vi con duoc chinh man "Tai khoan" nay dung lam dropdown).
router.use(authenticate, requireAdmin, requireAdminFeature('adminCanManageUsers'));

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:userId/permissions', controller.updatePermissions);
router.put('/:userId/schedule', controller.updateSchedule);
router.put('/:userId/report-access', controller.updateReportAccess);
router.put('/:userId/location', controller.updateLocation);
router.put('/:userId/company', controller.updateCompany);
router.put('/:userId/voucher-systems', controller.updateVoucherSystems);
router.put('/:userId/profile', controller.updateProfile);
router.put('/:userId/delete-status', controller.updateDeleteStatus);
router.put('/:userId/partner-admin', controller.updatePartnerAdmin);
router.put('/:userId/admin-features', controller.updateAdminFeaturePermissions);

module.exports = router;
