const permissionService = require('../services/permissionService');

/**
 * Chan `/api/core-reconciliation/*` - man hinh "Doi soat cheo Core" (sql/052), CHI danh cho tai
 * khoan Quan tri duoc cap RIENG quyen nay (ca HCRC lan Quan tri doi tac - theo yeu cau nguoi
 * dung: "chi co nguoi admin va phai duoc phan quyen"). Cung mau voi requireVoucherFilterAccess.js:
 *   - role=1 + AdminCanReconcileCore: vao duoc, pham vi 'ALL' (moi he thong/cong ty).
 *   - role=0 + isPartnerAdmin + PartnerAdminCanReconcileCore: vao duoc, pham vi 'CONNECTION'
 *     EP VE DUNG 1 ConnectionId da gan cho ho (req.reconcileConnectionId) - khong duoc chon he
 *     thong khac du co gui gi trong request.
 * Luon doc TRUC TIEP tu CSDL (khong tin JWT cu), giong cac middleware quyen khac trong app.
 */
async function requireReconcileCoreAccess(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chua dang nhap' });
    }
    if (Number(req.user.role) === 1) {
      const perms = await permissionService.getAdminFeaturePermissions(req.user.userId);
      if (!perms.adminCanReconcileCore) {
        return res.status(403).json({
          success: false,
          message: 'Tai khoan cua ban khong co quyen dung chuc nang Doi soat cheo Core - lien he 1 Quan tri khac de duoc cap quyen',
        });
      }
      req.reconcileScope = 'ALL';
      req.reconcileConnectionId = null;
      return next();
    }

    const permissions = await permissionService.getPermissions(req.user.userId);
    if (!permissions.isPartnerAdmin || !permissions.partnerAdminCanReconcileCore) {
      return res.status(403).json({
        success: false,
        message: 'Tai khoan cua ban khong co quyen dung chuc nang Doi soat cheo Core - lien he HCRC de duoc cap quyen',
      });
    }
    req.reconcileScope = 'CONNECTION';
    req.reconcileConnectionId = permissions.partnerAdminConnectionId;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireReconcileCoreAccess };
