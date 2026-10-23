const express = require('express');
const controller = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');

const router = express.Router();
router.use(authenticate, requireAdmin);

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:userId/permissions', controller.updatePermissions);
router.put('/:userId/schedule', controller.updateSchedule);
router.put('/:userId/report-access', controller.updateReportAccess);
router.put('/:userId/location', controller.updateLocation);
router.put('/:userId/voucher-systems', controller.updateVoucherSystems);
router.put('/:userId/profile', controller.updateProfile);
router.put('/:userId/delete-status', controller.updateDeleteStatus);
router.put('/:userId/partner-admin', controller.updatePartnerAdmin);

module.exports = router;
