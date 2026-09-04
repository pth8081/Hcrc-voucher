const express = require('express');
const { authenticate } = require('../middleware/auth');
const controller = require('../controllers/webauthn.controller');

const router = express.Router();

// Cong khai - dang nhap bang van tay/Face ID chua biet truoc la ai (discoverable credential).
router.post('/login-options', controller.authOptions);
router.post('/login-verify', controller.authVerify);

// Can dang nhap bang mat khau truoc moi duoc dang ky passkey cho thiet bi.
router.post('/register-options', authenticate, controller.registerOptions);
router.post('/register-verify', authenticate, controller.registerVerify);
router.get('/devices', authenticate, controller.listDevices);
router.delete('/devices/:id', authenticate, controller.removeDevice);

module.exports = router;
