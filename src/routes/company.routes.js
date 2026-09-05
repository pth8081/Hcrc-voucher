const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const controller = require('../controllers/company.controller');

const router = express.Router();
router.use(authenticate);
router.get('/', controller.list);
router.post('/', requireAdmin, controller.create);
router.put('/:id', requireAdmin, controller.update);

module.exports = router;
