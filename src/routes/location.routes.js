const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const locationController = require('../controllers/location.controller');

const router = express.Router();
router.use(authenticate);
router.get('/groups', locationController.groups);
router.get('/details', locationController.details);
// Tao dia diem moi la thao tac ghi vao bang dung chung voi he thong cu - gioi han rieng cho
// admin (khac 2 route GET o tren, van mo cho moi tai khoan da dang nhap nhu truoc).
router.post('/details', requireAdmin, locationController.createDetail);

module.exports = router;
