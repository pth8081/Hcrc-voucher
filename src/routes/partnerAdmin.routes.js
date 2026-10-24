const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requirePartnerAdmin } = require('../middleware/requirePartnerAdmin');
const controller = require('../controllers/partnerAdmin.controller');

const router = express.Router();
router.use(authenticate, requirePartnerAdmin);

router.get('/users', controller.list);
router.post('/users', controller.create);
router.put('/users/:userId/active', controller.setActive);

module.exports = router;
