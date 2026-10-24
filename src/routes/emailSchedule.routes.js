const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireFeature } = require('../middleware/requireFeature');
const controller = require('../controllers/emailSchedule.controller');

// Mo cho moi tai khoan co quyen xem IT NHAT 1 trong 3 loai bao cao - kiem tra CHI TIET dung loai
// bao cao nao duoc phep len lich o tung controller (assertCanUseReportType). Pham vi DANH SACH
// (admin = tat ca, tai khoan khac = chi lich cua chinh minh) xu ly trong emailScheduleService.js.
const router = express.Router();
router.use(authenticate, requireFeature(['canViewReconciliation', 'canViewSummary', 'canViewUsedVouchers']));

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.put('/:id/enabled', controller.setEnabled);
router.delete('/:id', controller.remove);
router.post('/:id/send-now', controller.sendNow);

module.exports = router;
