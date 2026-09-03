const express = require('express');
const { authenticate } = require('../middleware/auth');
const controller = require('../controllers/voucher.controller');

const router = express.Router();
router.use(authenticate);
router.post('/check', controller.check);
router.post('/redeem', controller.redeem);

module.exports = router;
