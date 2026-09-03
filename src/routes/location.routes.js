const express = require('express');
const { authenticate } = require('../middleware/auth');
const locationController = require('../controllers/location.controller');

const router = express.Router();
router.use(authenticate);
router.get('/groups', locationController.groups);
router.get('/details', locationController.details);

module.exports = router;
