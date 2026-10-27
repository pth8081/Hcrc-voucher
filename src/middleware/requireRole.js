const permissionService = require('../services/permissionService');

// Phan quyen don gian dua tren cot Users.status (1 = admin, 0 = nhan vien thu hoi)
// Neu can phan quyen chi tiet hon theo MenuItems/UserPermissions da co san trong schema,
// thay logic ben duoi bang truy van UserPermissions theo req.user.userId.
function requireAdmin(req, res, next) {
  if (!req.user || Number(req.user.role) !== 1) {
    return res.status(403).json({ success: false, message: 'Ban khong co quyen thuc hien thao tac nay' });
  }
  return next();
}

/**
 * M20 (v3.81): ban CHI TIET hon cua requireAdmin() - ngoai dieu kien role=1, con doc THEM 1
 * trong 5 quyen rieng cua tung man hinh "Quan tri" (AdminCanManageUnits/...Connections/...Users/
 * ViewAdminLog/...EmailSettings - xem permissionService.js#getAdminFeaturePermissions) truc tiep
 * tu CSDL moi lan goi (giong cach requirePartnerAdmin.js lam) - de 1 tai khoan Quan tri khac go
 * quyen nay co hieu luc NGAY lan goi API tiep theo, khong phai cho token cu het han.
 *
 * Dung thay requireAdmin() tren 5 nhom route ung voi 5 man hinh con cua "Quan tri" (vd
 * company.routes.js/redemptionUnit.routes.js/location.routes.js/accessGroup.routes.js deu phuc
 * vu CHUNG 1 man hinh units.html nen dung CHUNG 1 quyen adminCanManageUnits).
 */
function requireAdminFeature(flagName) {
  return async (req, res, next) => {
    try {
      if (!req.user || Number(req.user.role) !== 1) {
        return res.status(403).json({ success: false, message: 'Ban khong co quyen thuc hien thao tac nay' });
      }
      const perms = await permissionService.getAdminFeaturePermissions(req.user.userId);
      if (!perms[flagName]) {
        return res.status(403).json({ success: false, message: 'Tai khoan cua ban khong co quyen quan tri man hinh nay - lien he 1 Quan tri khac de duoc cap quyen' });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { requireAdmin, requireAdminFeature };
