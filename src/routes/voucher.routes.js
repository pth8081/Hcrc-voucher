const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireFeature } = require('../middleware/requireFeature');
const controller = require('../controllers/voucher.controller');

const router = express.Router();
router.use(authenticate);
router.post('/check', requireFeature('canRedeemVoucher'), controller.check);
router.post('/redeem', requireFeature('canRedeemVoucher'), controller.redeem);

module.exports = router;
