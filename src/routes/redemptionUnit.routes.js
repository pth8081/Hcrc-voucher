const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const controller = require('../controllers/redemptionUnit.controller');

const router = express.Router();
router.use(authenticate, requireAdmin);
router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
