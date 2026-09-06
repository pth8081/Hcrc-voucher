const express = require('express');
const authController = require('../controllers/auth.controller');
const { require2FAPending } = require('../middleware/require2FAPending');

const router = express.Router();
router.post('/login', authController.login);

// Doi mat khau BAT BUOC lan dang nhap dau tien - CHI chap nhan token TAM purpose='password_change'
// (require2FAPending doc token TAM theo purpose, khong rieng cho 2FA du ten file).
router.post('/change-password', require2FAPending(['password_change']), authController.changePassword);

module.exports = router;
