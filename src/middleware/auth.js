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
    // Doi mat khau (bat buoc lan dau hoac admin dat lai ho, xem passwordPolicyService.js) lam
    // token cu mat hieu luc ngay - 1 token DA BI LO (thiet bi dung chung, ro ri qua log, XSS...)
    // khong con dung duoc sau khi mat khau da doi de "khoa" ke gia mao.
    //
    // Dot ra soat sau phat hien: ban truoc so sanh "iat" (issued-at cua JWT, dong ho may chu
    // Node) voi PasswordChangedDate (ghi boi GETDATE(), dong ho SQL Server) - 2 DONG HO KHAC
    // NHAU co the lech nhau (VM khong dong bo NTP...), gay loi THAT trong production: token vua
    // cap NGAY SAU KHI doi mat khau (vd luong bat buoc doi mat khau lan dau -> 2FA -> cap phien)
    // bi coi NHAM la cap TRUOC lan doi do, tu choi ngay lap tuc - tai khoan vua dang nhap xong
    // bi dang xuat lien tuc, khong the nao vao duoc (xem sql/025_add_password_version.sql).
    // Thay bang so sanh PasswordVersion (so nguyen, tang don gian +1 moi lan doi/dat lai mat
    // khau, nhung san vao token luc cap - issueSession) - KHONG con phu thuoc dong ho may nao,
    // an toan tuyet doi du 2 may lech gio bao nhieu. payload.passwordVersion === undefined (token
    // cap TRUOC khi tinh nang nay ton tai) duoc bo qua kiem tra nay, giu nguyen hanh vi cu cho
    // toi khi token do het han tu nhien - tranh dang xuat hang loat ngay luc trien khai ban vá.
    if (state.passwordVersion && payload.passwordVersion !== undefined && payload.passwordVersion < state.passwordVersion) {
      return res
        .status(401)
        .json({ success: false, message: 'Mat khau tai khoan nay vua duoc doi, vui long dang nhap lai.' });
    }
    // M17: "1 tai khoan = 1 phien dang nhap dang hoat dong" (sql/036) - token mang sessionVersion
    // THAP HON gia tri hien tai trong CSDL nghia la DA CO 1 lan dang nhap KHAC (thiet bi/trinh
    // duyet khac) xay ra SAU token nay, lam no "lac hau" - tu choi ngay, khong doi den khi het
    // han 8h mac dinh. Cung quy uoc voi passwordVersion ngay tren: payload.sessionVersion ===
    // undefined (token cap TRUOC khi tinh nang nay ton tai) duoc bo qua kiem tra, giu nguyen
    // hanh vi cu cho toi khi token do het han tu nhien - tranh dang xuat hang loat ngay luc
    // trien khai ban vá.
    if (state.sessionVersion && payload.sessionVersion !== undefined && payload.sessionVersion < state.sessionVersion) {
      return res
        .status(401)
        .json({ success: false, message: 'Tai khoan nay vua dang nhap o 1 noi khac, phien nay khong con hieu luc.' });
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
