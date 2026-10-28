const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const controller = require('../controllers/partnerOverview.controller');

const router = express.Router();
// Chi doc (khong co thao tac sua/xoa nao o man hinh nay) - mo cho MOI tai khoan Quan tri day du
// (role=1), khong doi hoi 1 quyen AdminCanXxx rieng, vi du lieu hien thi o day (cong ty/diem
// tieu/tai khoan theo tung doi tac) deu la du lieu da the xem duoc tung phan rieng le qua cac man
// hinh "Don vi thu hoi"/"Tai khoan" co san - man hinh nay chi gop lai 1 cho de xem tong quan, khong
// lo them du lieu moi nao.
router.use(authenticate, requireAdmin);
router.get('/', controller.list);

module.exports = router;
