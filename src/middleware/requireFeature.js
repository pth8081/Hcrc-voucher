const permissionService = require('../services/permissionService');

/**
 * Chan API theo QUYEN TINH NANG cua tai khoan (xem sql/014, permissionService.js) - khac voi
 * requireRole.js (chi phan biet admin/nhan vien). Admin luon duoc next() thang, khong can tra
 * bang - dung 1 cach nhat quan voi reportAccessService.js (admin mac dinh full quyen).
 *
 * `flag` co the la 1 chuoi (can dung quyen do), hoac 1 mang cac chuoi (du 1 trong cac quyen la
 * du - dung cho cac API loc dung chung tren nhieu man hinh bao cao khac nhau, vi du danh sach
 * cong ty/diem thu hoi dung chung ca 3 bao cao).
 */
function requireFeature(flag) {
  const flags = Array.isArray(flag) ? flag : [flag];
  return async function (req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Chua dang nhap' });
      }
      if (Number(req.user.role) === 1) return next();

      const permissions = await permissionService.getPermissions(req.user.userId);
      if (!flags.some((f) => permissions[f])) {
        return res.status(403).json({ success: false, message: 'Tai khoan cua ban khong co quyen thuc hien thao tac nay' });
      }
      return next();
    } catch (err) {
      // Dot ra soat sau phat hien: loi o day (vd truy van CSDL that bai) truoc day roi thang vao
      // nhanh 500 chung chung cua errorHandler.js ("Da xay ra loi he thong") - nguoi dung thay
      // thong bao vo nghia, khong biet huong xu ly, con khong co log server thi khong cach nao
      // biet LOI GI. Gan publicMessage ro rang (chi khi CHUA co san - khong ghi de loi nghiep vu
      // da duoc phan loai tu truoc) de toast hien thi dung nguyen nhan that.
      if (!err.publicMessage) {
        err.publicMessage = `Loi khi kiem tra quyen su dung tinh nang: ${err.message}`;
      }
      return next(err);
    }
  };
}

module.exports = { requireFeature };
