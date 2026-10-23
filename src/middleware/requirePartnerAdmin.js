const permissionService = require('../services/permissionService');

/**
 * Chan toan bo `/api/partner-admin/*` - CHI tai khoan duoc gan PartnerAdminConnectionId (xem
 * sql/031, permissionService.js#setPartnerAdminConnection) moi goi duoc. Luon doc TRUC TIEP tu
 * CSDL (khong tin theo bat ky gia tri nao client gui len hay "chup" san trong JWT) - giong cach
 * requireFeature.js lam, de 1 admin HCRC go quyen nay cua 1 tai khoan co hieu luc NGAY lan goi
 * API tiep theo, khong phai cho token cu het han.
 *
 * Tai khoan quan tri DAY DU (role=1) bi tu choi o day (khong duoc dung duong nay) - ho da co
 * toan bo man hinh "Tai khoan" day du roi; API nay CHI tra ve 1 tap con rat hep (dung loc theo
 * DUNG 1 connectionId), de ho goi nham vao day se hieu lam la "toan bo tai khoan" trong khi thuc
 * ra khong phai.
 */
async function requirePartnerAdmin(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chua dang nhap' });
    }
    if (Number(req.user.role) === 1) {
      return res.status(403).json({ success: false, message: 'Tai khoan quan tri day du vui long dung man hinh "Tai khoan"' });
    }
    const permissions = await permissionService.getPermissions(req.user.userId);
    if (!permissions.partnerAdminConnectionId) {
      return res.status(403).json({ success: false, message: 'Tai khoan cua ban khong co quyen quan tri doi tac' });
    }
    req.partnerAdminConnectionId = permissions.partnerAdminConnectionId;
    req.partnerAdminConnectionName = permissions.partnerAdminConnectionName;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requirePartnerAdmin };
