const express = require('express');
const { authenticate } = require('../middleware/auth');
const controller = require('../controllers/report.controller');

const router = express.Router();
router.use(authenticate);
router.get('/daily', controller.daily);

module.exports = router;
