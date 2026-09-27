const express = require('express');
const { requireApiKey } = require('../middleware/apiKeyAuth');
const { requireFeature } = require('../middleware/requireFeature');
const controller = require('../controllers/partnerVoucher.controller');

// API danh cho doi tac tich hop truc tiep bang X-API-Key (khong qua dang nhap/JWT) - xem
// middleware/apiKeyAuth.js va docs/api-voucher-check-redeem.md. requireFeature tai dung nguyen
// ven logic phan quyen hien co (dua vao req.user.userId/role ma apiKeyAuth da thiet lap giong
// het middleware/auth.js) - tai khoan gan voi key phai duoc cap quyen canRedeemVoucher.
const router = express.Router();
router.post('/check', requireApiKey('check'), requireFeature('canRedeemVoucher'), controller.check);
router.post('/redeem', requireApiKey('redeem'), requireFeature('canRedeemVoucher'), controller.redeem);

module.exports = router;
