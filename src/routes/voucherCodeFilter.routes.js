const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireVoucherFilterAccess } = require('../middleware/requireVoucherFilterAccess');
const controller = require('../controllers/voucherCodeFilter.controller');

const router = express.Router();
router.use(authenticate, requireVoucherFilterAccess);

router.get('/', controller.list);
router.put('/:id', controller.update);

module.exports = router;
