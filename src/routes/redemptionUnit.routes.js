const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireAdmin, requireAdminFeature } = require('../middleware/requireRole');
const controller = require('../controllers/redemptionUnit.controller');

const router = express.Router();
router.use(authenticate, requireAdmin);
// GET mo cho moi tai khoan Quan tri (xem company.routes.js) - THEM/SUA/XOA can adminCanManageUnits.
router.get('/', controller.list);
router.post('/', requireAdminFeature('adminCanManageUnits'), controller.create);
router.put('/:id', requireAdminFeature('adminCanManageUnits'), controller.update);
router.delete('/:id', requireAdminFeature('adminCanManageUnits'), controller.remove);

module.exports = router;
