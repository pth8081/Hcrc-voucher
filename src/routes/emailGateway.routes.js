const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const controller = require('../controllers/emailGateway.controller');

// Cau hinh may chu gui email (SMTP) la ha tang DUNG CHUNG (vd dia chi IP noi bo, mat khau tai
// khoan gui mail that) - CHI quan tri DAY DU moi duoc xem/sua, KHONG mo cho "Quan tri doi tac"
// (khac voi /api/email-schedules, noi ca 2 nhom deu dung duoc nhung pham vi du lieu khac nhau).
const router = express.Router();
router.use(authenticate, requireAdmin);

router.get('/', controller.getConfig);
router.put('/', controller.saveConfig);
router.post('/test', controller.sendTest);

module.exports = router;
