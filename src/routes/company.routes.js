const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireAdmin, requireAdminFeature } = require('../middleware/requireRole');
const controller = require('../controllers/company.controller');

const router = express.Router();
router.use(authenticate, requireAdmin);
// GET mo cho MOI tai khoan Quan tri (khong doi hoi adminCanManageUnits) - du lieu nay con duoc
// dung lam dropdown/bao cao o man hinh "Tai khoan" (vd gan Cong ty luc tao tai khoan, Bao cao
// phan quyen he thong) - chi rieng THEM/SUA/XOA (quan tri THAT su) moi can quyen rieng man hinh
// "Don vi thu hoi" (xem requireRole.js#requireAdminFeature).
router.get('/', controller.list);
router.get('/:id/convert-preview', controller.convertPreview);
router.post('/', requireAdminFeature('adminCanManageUnits'), controller.create);
router.put('/:id', requireAdminFeature('adminCanManageUnits'), controller.update);
router.delete('/:id', requireAdminFeature('adminCanManageUnits'), controller.remove);

module.exports = router;
