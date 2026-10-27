const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireAdmin, requireAdminFeature } = require('../middleware/requireRole');
const locationController = require('../controllers/location.controller');

const router = express.Router();
router.use(authenticate, requireAdmin);
// Ca 4 route deu chi admin goi duoc: day la du lieu dia diem/nhom TOAN HE THONG (khong loc theo
// cong ty/pham vi tai khoan), chi dung lam dropdown cho man hinh quan tri (Dia diem/Diem tieu) -
// mo cho moi tai khoan da dang nhap se lo ten/ma dia diem cua CA cong ty khac cho 1 nhan vien chi
// duoc xem bao cao cong ty cua minh (ro ri thong tin xuyen cong ty qua goi API truc tiep).
// GET mo cho moi tai khoan Quan tri (xem company.routes.js) - THEM/SUA can adminCanManageUnits.
router.get('/groups', locationController.groups);
router.get('/details', locationController.details);
router.post('/details', requireAdminFeature('adminCanManageUnits'), locationController.createDetail);
router.put('/details/:id', requireAdminFeature('adminCanManageUnits'), locationController.updateDetail);

module.exports = router;
