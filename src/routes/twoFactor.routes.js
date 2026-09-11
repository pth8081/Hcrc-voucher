const express = require('express');
const controller = require('../controllers/twoFactor.controller');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const { require2FAPending, resolveSetupSubject } = require('../middleware/require2FAPending');
const { ipLoginRateLimit } = require('../middleware/ipRateLimit');

const router = express.Router();

// Thiet lap 2FA: chap nhan CA token TAM (buoc bat buoc lan dau) LAN phien day du cua chinh
// admin do (tu chon doi thiet bi) - xem middleware/require2FAPending.js#resolveSetupSubject.
// H2: co kiem tra mat khau khi doi thiet bi tu phien day du (C3) nen cung ap dung rate-limit IP.
router.post('/setup-init', ipLoginRateLimit, resolveSetupSubject, controller.setupInit);
// Rieng endpoint nay TRUOC DAY khong co gioi han lan thu nao (khong loginGuard, khong
// ipLoginRateLimit) du la buoc nhap ma TOTP 6 chu so - bi bo lot khi them rate-limit cho cac
// endpoint 2FA anh chi em (setup-init/login-verify/show-qr) o dot vá truoc (da bi 1 dot ra soat
// sau phat hien). Them ca 2 lop nhu loginVerify.
router.post('/setup-verify', ipLoginRateLimit, resolveSetupSubject, controller.setupVerify);

// Xac minh ma 2FA khi dang nhap (da bat 2FA tu truoc) - CHI chap nhan token TAM purpose='2fa_verify'.
router.post('/login-verify', ipLoginRateLimit, require2FAPending(['2fa_verify']), controller.loginVerify);

// Quan ly 2FA - can phien day du + quyen quan tri.
router.get('/status', authenticate, requireAdmin, controller.status);
router.post('/show-qr', ipLoginRateLimit, authenticate, requireAdmin, controller.showQr);
router.get('/admins', authenticate, requireAdmin, controller.listAdmins);
router.delete('/admins/:userId', authenticate, requireAdmin, controller.adminReset);

module.exports = router;
