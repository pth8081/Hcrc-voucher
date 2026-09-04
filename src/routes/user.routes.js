const express = require('express');
const controller = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');

const router = express.Router();
router.use(authenticate, requireAdmin);

router.get('/', controller.list);
router.put('/:userId/schedule', controller.updateSchedule);

module.exports = router;
