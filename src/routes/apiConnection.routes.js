const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireAdmin, requireAdminFeature } = require('../middleware/requireRole');
const controller = require('../controllers/apiConnection.controller');

const router = express.Router();
router.use(authenticate, requireAdmin);
// GET mo cho moi tai khoan Quan tri (du lieu dung lam dropdown "He thong voucher duoc dung" o
// man hinh "Tai khoan", bao cao phan quyen he thong... - xem company.routes.js) - cac thao tac
// quan tri THAT (them/sua/khoa/test...) can adminCanManageConnections (man hinh "Ket noi API").
router.get('/defaults', controller.getDefaults);
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', requireAdminFeature('adminCanManageConnections'), controller.create);
router.put('/:id', requireAdminFeature('adminCanManageConnections'), controller.update);
router.post('/:id/activate', requireAdminFeature('adminCanManageConnections'), controller.activate);
router.post('/:id/lock', requireAdminFeature('adminCanManageConnections'), (req, res, next) => controller.setLocked(req, res, next, true));
router.post('/:id/unlock', requireAdminFeature('adminCanManageConnections'), (req, res, next) => controller.setLocked(req, res, next, false));
router.delete('/:id', requireAdminFeature('adminCanManageConnections'), controller.remove);

router.post('/test-check', requireAdminFeature('adminCanManageConnections'), controller.testCheck);
router.post('/test-redeem', requireAdminFeature('adminCanManageConnections'), controller.testRedeem);

module.exports = router;
