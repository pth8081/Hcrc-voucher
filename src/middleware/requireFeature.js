const permissionService = require('../services/permissionService');

/**
 * Chan API theo QUYEN TINH NANG cua tai khoan (xem sql/014, permissionService.js) - khac voi
 * requireRole.js (chi phan biet admin/nhan vien). Admin luon duoc next() thang, khong can tra
 * bang - dung 1 cach nhat quan voi reportAccessService.js (admin mac dinh full quyen).
 */
function requireFeature(flag) {
  return async function (req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Chua dang nhap' });
      }
      if (Number(req.user.role) === 1) return next();

      const permissions = await permissionService.getPermissions(req.user.userId);
      if (!permissions[flag]) {
        return res.status(403).json({ success: false, message: 'Tai khoan cua ban khong co quyen thuc hien thao tac nay' });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { requireFeature };
