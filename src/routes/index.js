const express = require('express');

const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/auth/webauthn', require('./webauthn.routes'));
router.use('/auth/2fa', require('./twoFactor.routes'));
router.use('/users', require('./user.routes'));
router.use('/access-groups', require('./accessGroup.routes'));
router.use('/locations', require('./location.routes'));
router.use('/redemption-units', require('./redemptionUnit.routes'));
router.use('/companies', require('./company.routes'));
router.use('/api-connections', require('./apiConnection.routes'));
router.use('/vouchers', require('./voucher.routes'));
router.use('/reports', require('./report.routes'));
router.use('/admin', require('./adminLog.routes'));
router.use('/partner-api-keys', require('./partnerApiKey.routes'));
// Danh cho doi tac tich hop truc tiep bang X-API-Key (khong qua JWT/dang nhap web) - xem
// middleware/apiKeyAuth.js va docs/api-voucher-check-redeem.md.
router.use('/v1/vouchers', require('./partnerVoucher.routes'));

module.exports = router;
