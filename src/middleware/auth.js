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
    // Dot ra soat sau phat hien: doi mat khau (bat buoc lan dau hoac admin dat lai ho, xem
    // passwordPolicyService.js) truoc day KHONG lam token cu mat hieu luc - 1 token DA BI LO
    // (thiet bi dung chung, ro ri qua log, XSS...) van dung duoc binh thuong du mat khau da
    // duoc doi de "khoa" ke gia mao. "iat" (issued-at, giay) cua JWT luon co san (jwt.sign
    // khong tat noTimestamp) - tu choi token nao CAP TRUOC lan doi mat khau gan nhat. Co 1
    // khoang du (CLOCK_SKEW_TOLERANCE_MS) vi ngay chinh token MOI cap RA NGAY SAU khi doi mat
    // khau xong (changePasswordForced -> issueSession) co the co "iat" (dong ho may ung dung,
    // lam tron xuong giay) som hon vai chuc/tram mili-giay so voi GETDATE() da ghi (dong ho
    // SQL Server) neu 2 dong ho lech nhau - khong co khoang du nay, chinh phien VUA dang nhap
    // xong co the bi tu choi ngay o request tiep theo (tu khoa chinh minh).
    const CLOCK_SKEW_TOLERANCE_MS = 10 * 1000;
    if (state.passwordChangedAt && payload.iat && payload.iat * 1000 < state.passwordChangedAt - CLOCK_SKEW_TOLERANCE_MS) {
      return res
        .status(401)
        .json({ success: false, message: 'Mat khau tai khoan nay vua duoc doi, vui long dang nhap lai.' });
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
