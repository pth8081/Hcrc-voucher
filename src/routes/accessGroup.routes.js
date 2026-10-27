const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireAdmin, requireAdminFeature } = require('../middleware/requireRole');
const controller = require('../controllers/accessGroup.controller');

const router = express.Router();
router.use(authenticate, requireAdmin);
// GET mo cho moi tai khoan Quan tri (dung lam dropdown "Nhom quyen xem bao cao" o man hinh "Tai
// khoan", xem company.routes.js) - THEM/SUA/XOA can adminCanManageUnits (cung man hinh voi
// Cong ty/Diem tieu - tab "Nhom quyen xem bao cao" nam trong units.html).
router.get('/', controller.list);
router.post('/', requireAdminFeature('adminCanManageUnits'), controller.create);
router.put('/:id', requireAdminFeature('adminCanManageUnits'), controller.update);
router.delete('/:id', requireAdminFeature('adminCanManageUnits'), controller.remove);

module.exports = router;
