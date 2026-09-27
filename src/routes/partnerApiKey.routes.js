const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const controller = require('../controllers/partnerApiKey.controller');

// Quan tri API key cho doi tac (nguoi tao/thu hoi PHAI dang nhap qua UI web binh thuong, JWT +
// requireAdmin - khac han chinh cac key nay, dung de XAC THUC request tu doi tac o
// partnerVoucher.routes.js).
const router = express.Router();
router.use(authenticate, requireAdmin);
router.get('/', controller.list);
router.post('/', controller.create);
router.delete('/:id', controller.revoke);

module.exports = router;
