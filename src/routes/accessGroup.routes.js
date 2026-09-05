const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const controller = require('../controllers/accessGroup.controller');

const router = express.Router();
router.use(authenticate, requireAdmin);

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);

module.exports = router;
