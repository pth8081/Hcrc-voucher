const authService = require('../services/authService');

/**
 * Chan 2 API quan ly 2FA cua CHINH tai khoan dang dang nhap (`GET /auth/2fa/status`,
 * `POST /auth/2fa/show-qr`) - mo cho CA quan tri DAY DU LAN tai khoan "Quan tri doi tac" (muc
 * 4j), vi ca 2 deu BAT BUOC dung 2FA (xem authService.js#requiresMandatory2FA - 1 nguon su that
 * duy nhat, dung CHUNG dieu kien voi luc dang nhap). KHAC voi `requireRole.js#requireAdmin` (chi
 * role=1) van dung cho 2 API con lai (`/admins`, `/admins/:userId`) - 2 API do lien quan TOI TAI
 * KHOAN KHAC (xem/go 2FA cua MOI quan tri vien trong he thong), khong phai cua chinh minh, nen
 * van gioi han CHI quan tri day du moi duoc xem/can thiep.
 */
async function require2FAManagement(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chua dang nhap' });
    }
    const allowed = await authService.requiresMandatory2FA(req.user.role, req.user.userId);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Tai khoan cua ban khong bat buoc xac thuc hai yeu to' });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { require2FAManagement };
