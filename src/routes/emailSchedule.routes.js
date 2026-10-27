const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireFeature } = require('../middleware/requireFeature');
const controller = require('../controllers/emailSchedule.controller');

// v3.84: BAT BUOC CA 2 dieu kien (AND, 2 lan goi requireFeature rieng) - (1) co quyen xem IT
// NHAT 1 trong 3 loai bao cao (kiem tra CHI TIET dung loai bao cao nao duoc phep len lich o tung
// controller, xem assertCanUseReportType), VA (2) duoc cap RIENG quyen "Lich gui email bao cao"
// (canManageEmailSchedules) - truoc ban nay chi can dieu kien (1) la du, khien BAT KY nhan vien
// nao co quyen xem bao cao la tu dong co luon quyen tu dat lich gui email, theo yeu cau nguoi
// dung: phai la Quan tri doi tac/Quan tri day du, hoac duoc cap RIENG quyen nay. Pham vi DANH
// SACH (admin = tat ca, tai khoan khac = chi lich cua chinh minh) xu ly trong emailScheduleService.js.
const router = express.Router();
router.use(
  authenticate,
  requireFeature(['canViewReconciliation', 'canViewSummary', 'canViewUsedVouchers']),
  requireFeature('canManageEmailSchedules')
);

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.put('/:id/enabled', controller.setEnabled);
router.delete('/:id', controller.remove);
router.post('/:id/send-now', controller.sendNow);

module.exports = router;
