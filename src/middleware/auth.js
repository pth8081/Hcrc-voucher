const jwt = require('jsonwebtoken');
const sessionRevalidation = require('../utils/sessionRevalidation');

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Thieu token xac thuc' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
    // Token TAM (purpose='2fa_setup'/'2fa_verify', xem authService.issuePendingToken) khong
    // duoc coi la phien dang nhap day du - chan o day de khong the dung no goi bat ky API
    // nghiep vu nao khac ngoai 2 buoc thiet lap/xac minh 2FA (middleware/require2FAPending.js).
    if (payload.purpose !== 'session') {
      return res.status(401).json({ success: false, message: 'Token khong hop le hoac het han' });
    }
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token khong hop le hoac het han' });
  }

  // H1: token chi "chup" role/trang thai LUC DANG NHAP - doi chieu lai voi CSDL (qua cache TTL
  // ngan, xem sessionRevalidation.js) de 1 tai khoan bi khoa/xoa/ha quyen SAU khi phat hanh
  // token co hieu luc gan nhu ngay lap tuc, khong phai cho den khi token het han (mac dinh 8h).
  try {
    const state = await sessionRevalidation.getFreshUserState(payload.userId);
    if (!state.exists || state.isDeleted || state.activeState !== 'active') {
      return res.status(401).json({ success: false, message: 'Phien dang nhap khong con hieu luc, vui long dang nhap lai.' });
    }
    // Luon dung role MOI NHAT tu CSDL cho cac buoc phan quyen phia sau (requireAdmin,
    // requireFeature...), khong tin role "chup" cu trong token - dong thoi vo hieu hoa viec
    // ha quyen 1 admin xuong nhan vien nhung token cu van con duoc coi la admin.
    req.user = { ...payload, role: state.role };
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { authenticate };
