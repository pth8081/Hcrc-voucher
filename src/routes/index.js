const express = require('express');

const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/auth/webauthn', require('./webauthn.routes'));
router.use('/auth/2fa', require('./twoFactor.routes'));
router.use('/users', require('./user.routes'));
router.use('/locations', require('./location.routes'));
router.use('/redemption-units', require('./redemptionUnit.routes'));
router.use('/api-connections', require('./apiConnection.routes'));
router.use('/vouchers', require('./voucher.routes'));
router.use('/reports', require('./report.routes'));

module.exports = router;
