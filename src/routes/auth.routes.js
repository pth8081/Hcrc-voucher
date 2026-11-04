const express = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { require2FAPending } = require('../middleware/require2FAPending');
const { ipLoginRateLimit } = require('../middleware/ipRateLimit');

const router = express.Router();
router.get('/captcha', authController.getCaptcha);
router.post('/login', ipLoginRateLimit, authController.login);

// Doi mat khau BAT BUOC lan dang nhap dau tien - CHI chap nhan token TAM purpose='password_change'
// (require2FAPending doc token TAM theo purpose, khong rieng cho 2FA du ten file).
router.post('/change-password', ipLoginRateLimit, require2FAPending(['password_change']), authController.changePassword);

// Hoan tat dang nhap sau khi dong y "ghi de" phien cu (hop thoai SESSION_CONFLICT) - CHI chap
// nhan confirmToken rieng (purpose='session_takeover', xem authService.js#sessionConflict).
router.post('/confirm-takeover', ipLoginRateLimit, require2FAPending(['session_takeover']), authController.confirmTakeover);

// Dang xuat THAT (vo hieu hoa phien ngay tren server) - can token phien day du hop le de biet
// dang xuat tai khoan nao (xem auth.controller.js#logout).
router.post('/logout', authenticate, authController.logout);

module.exports = router;
