const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireFeature } = require('../middleware/requireFeature');
const controller = require('../controllers/guide.controller');

// Noi dung huong dan CHI tra ve qua API nay (khong nhung san trong file HTML tinh) de quyen
// "canViewBusinessGuide"/"canViewSystemGuide" duoc thuc thi THAT SU o server - mot tai khoan
// khong duoc cap quyen se khong lay duoc noi dung du co doan duoc URL trang, dung nguyen tac ap
// dung cho moi tinh nang khac cua app (du lieu luon qua API co kiem tra quyen, khong dua vao an
// nut/menu phia giao dien).
const router = express.Router();
router.use(authenticate);
router.get('/business', requireFeature('canViewBusinessGuide'), controller.business);
router.get('/system', requireFeature('canViewSystemGuide'), controller.system);

module.exports = router;
