const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const controller = require('../controllers/apiConnection.controller');

const router = express.Router();
router.use(authenticate, requireAdmin);

router.get('/defaults', controller.getDefaults);
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.post('/:id/activate', controller.activate);
router.delete('/:id', controller.remove);

router.post('/test-check', controller.testCheck);
router.post('/test-redeem', controller.testRedeem);

module.exports = router;
