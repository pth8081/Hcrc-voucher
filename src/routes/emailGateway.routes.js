const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireAdmin, requireAdminFeature } = require('../middleware/requireRole');
const controller = require('../controllers/emailGateway.controller');

// Cau hinh may chu gui email (SMTP) la ha tang DUNG CHUNG (vd dia chi IP noi bo, mat khau tai
// khoan gui mail that) - CHI quan tri DAY DU moi duoc xem/sua, KHONG mo cho "Quan tri doi tac"
// (khac voi /api/email-schedules, noi ca 2 nhom deu dung duoc nhung pham vi du lieu khac nhau).
// Toan bo man hinh "Thiet lap email" (public/email-settings.html) - khong co man nao khac goi API nay.
const router = express.Router();
router.use(authenticate, requireAdmin, requireAdminFeature('adminCanManageEmailSettings'));

router.get('/', controller.getConfig);
router.put('/', controller.saveConfig);
router.post('/test', controller.sendTest);

module.exports = router;
