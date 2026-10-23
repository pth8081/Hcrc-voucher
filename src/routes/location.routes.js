const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const locationController = require('../controllers/location.controller');

const router = express.Router();
router.use(authenticate, requireAdmin);
// Ca 4 route deu chi admin goi duoc: day la du lieu dia diem/nhom TOAN HE THONG (khong loc theo
// cong ty/pham vi tai khoan), chi dung lam dropdown cho man hinh quan tri (Dia diem/Diem tieu) -
// mo cho moi tai khoan da dang nhap se lo ten/ma dia diem cua CA cong ty khac cho 1 nhan vien chi
// duoc xem bao cao cong ty cua minh (ro ri thong tin xuyen cong ty qua goi API truc tiep).
router.get('/groups', locationController.groups);
router.get('/details', locationController.details);
router.post('/details', locationController.createDetail);
router.put('/details/:id', locationController.updateDetail);

module.exports = router;
