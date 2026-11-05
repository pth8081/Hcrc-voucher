const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireReconcileCoreAccess } = require('../middleware/requireReconcileCoreAccess');
const controller = require('../controllers/coreReconciliation.controller');

const router = express.Router();
router.use(authenticate, requireReconcileCoreAccess);

router.get('/filters', controller.getFilters);
router.post('/estimate', controller.estimate);
router.post('/', controller.start);
router.get('/', controller.listRuns);
router.get('/:id', controller.getRun);
router.get('/:id/export', controller.exportExcel);
router.post('/:id/send-email', controller.sendEmail);

module.exports = router;
