const express = require('express');

const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/auth/webauthn', require('./webauthn.routes'));
router.use('/auth/2fa', require('./twoFactor.routes'));
router.use('/users', require('./user.routes'));
router.use('/partner-admin', require('./partnerAdmin.routes'));
router.use('/access-groups', require('./accessGroup.routes'));
router.use('/locations', require('./location.routes'));
router.use('/redemption-units', require('./redemptionUnit.routes'));
router.use('/companies', require('./company.routes'));
router.use('/api-connections', require('./apiConnection.routes'));
router.use('/voucher-code-filter', require('./voucherCodeFilter.routes'));
router.use('/partner-overview', require('./partnerOverview.routes'));
router.use('/vouchers', require('./voucher.routes'));
router.use('/reports', require('./report.routes'));
router.use('/admin', require('./adminLog.routes'));
router.use('/guides', require('./guide.routes'));
router.use('/email-gateway', require('./emailGateway.routes'));
router.use('/email-schedules', require('./emailSchedule.routes'));

module.exports = router;
