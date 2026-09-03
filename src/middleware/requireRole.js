// Phan quyen don gian dua tren cot Users.status (1 = admin, 0 = nhan vien thu hoi)
// Neu can phan quyen chi tiet hon theo MenuItems/UserPermissions da co san trong schema,
// thay logic ben duoi bang truy van UserPermissions theo req.user.userId.
function requireAdmin(req, res, next) {
  if (!req.user || Number(req.user.role) !== 1) {
    return res.status(403).json({ success: false, message: 'Ban khong co quyen thuc hien thao tac nay' });
  }
  return next();
}

module.exports = { requireAdmin };
