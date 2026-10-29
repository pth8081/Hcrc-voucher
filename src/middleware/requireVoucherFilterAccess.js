const permissionService = require('../services/permissionService');

/**
 * Chan `/api/voucher-code-filter/*` - man hinh RIENG, GON hon "Ket noi API", CHI cho sua loc ma
 * voucher theo tien to (sql/047/049). Khac voi requireAdminFeature (chi phuc vu role=1) va
 * requirePartnerAdmin (chi phuc vu doi tac), middleware nay phuc vu CA 2 doi tuong tren CUNG 1
 * route, vi yeu cau nguoi dung la "ca Quan tri HCRC lan Quan tri doi tac deu dung duoc, neu duoc
 * cap quyen rieng":
 *   - role=1 + AdminCanManageVoucherFilter: sua duoc MOI ket noi (scope='all').
 *   - role=0 + isPartnerAdmin + PartnerAdminCanManageVoucherFilter: CHI sua duoc DUNG 1 ket noi
 *     da gan cho ho (scope='own', req.voucherFilterConnectionId) - KHONG duoc dung he thong cua
 *     doi tac khac, du co quyen nay.
 * Luon doc TRUC TIEP tu CSDL (khong tin JWT cu) - giong cach requireAdminFeature/requirePartnerAdmin
 * lam, de 1 Quan tri khac go/cap quyen nay co hieu luc NGAY lan goi API tiep theo.
 *
 * req.voucherFilterScope duoc controller TU KIEM TRA LAI (double-check) truoc khi cho sua 1 id cu
 * the - khong chi dua vao middleware nay, phong truong hop sau nay co route khac vo tinh dung
 * nham middleware ma quen kiem tra scope o tung thao tac ghi.
 */
async function requireVoucherFilterAccess(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chua dang nhap' });
    }
    if (Number(req.user.role) === 1) {
      const perms = await permissionService.getAdminFeaturePermissions(req.user.userId);
      if (!perms.adminCanManageVoucherFilter) {
        return res.status(403).json({
          success: false,
          message: 'Tai khoan cua ban khong co quyen cau hinh loc ma voucher - lien he 1 Quan tri khac de duoc cap quyen',
        });
      }
      req.voucherFilterScope = 'all';
      return next();
    }

    const permissions = await permissionService.getPermissions(req.user.userId);
    if (!permissions.isPartnerAdmin || !permissions.partnerAdminCanManageVoucherFilter) {
      return res.status(403).json({
        success: false,
        message: 'Tai khoan cua ban khong co quyen cau hinh loc ma voucher - lien he HCRC de duoc cap quyen',
      });
    }
    req.voucherFilterScope = 'own';
    req.voucherFilterConnectionId = permissions.partnerAdminConnectionId;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireVoucherFilterAccess };
