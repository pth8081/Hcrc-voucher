// H2: loginGuard.js chi khoa theo TEN DANG NHAP (co chu dich, xem ghi chu o do) - nen hoan
// toan "mu" truoc kieu tan cong "password spraying" (thu 1-2 mat khau pho bien tren RAT NHIEU
// tai khoan khac nhau tu 1 nguon), vi khong tai khoan nao rieng le vuot nguong khoa. Middleware
// nay them 1 lop CHAN THEO DIA CHI IP, doc lap voi loginGuard, ap dung cho cac endpoint nhap
// thong tin xac thuc (dang nhap, xac minh 2FA, dang nhap van tay). Nguong rong rai (khong phai
// de thay the loginGuard, chi de chan spam/spray quy mo lon tu 1 nguon).
const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS = 30;

const state = new Map(); // ip -> { count, windowStart }

// Dot ra soat sau phat hien: truoc day khong bao gio don dep cac dong da het han (window da
// troi qua) - 1 tien trinh chay dai ngay (khong restart) tren endpoint dang nhap CONG KHAI (bat
// ky dia chi IP nao goi toi, ke ca bot/scanner tu dong tren Internet) se khien Map nay phinh to
// dan theo thoi gian, khong bao gio nho lai. Don dep dinh ky (cung kieu voi captcha.js) sau moi
// vai tram dia chi moi, xoa cac dong da het han tu lau.
function cleanupExpired() {
  const now = Date.now();
  for (const [ip, s] of state) {
    if (now - s.windowStart > WINDOW_MS) state.delete(ip);
  }
}

function ipLoginRateLimit(req, res, next) {
  const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
  const now = Date.now();
  let s = state.get(ip);
  if (!s || now - s.windowStart > WINDOW_MS) {
    s = { count: 0, windowStart: now };
  }
  state.set(ip, s);
  if (state.size % 500 === 0) cleanupExpired();

  if (s.count >= MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      message: 'Qua nhieu yeu cau dang nhap tu mang nay trong thoi gian ngan, vui long thu lai sau it phut.',
    });
  }

  // Chi tinh vao gioi han cac lan THAT BAI (status >= 400) - giong triet ly cua loginGuard.js.
  // Truoc day tinh CA cac lan thanh cong, nen bang 1 thiet bi/quay dung chung nhieu nhan vien
  // (chinh kich ban README ghi nhan ro) co the tu khoa chinh minh chi vi dang nhap thanh cong
  // lien tuc trong gio cao diem (da bi 1 dot ra soat sau phat hien) - trong khi muc dich that su
  // cua middleware nay la chan spam/spray CO CHU DICH tu 1 nguon, khong phai chan luu luong hop le.
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      s.count += 1;
    }
  });
  return next();
}

module.exports = { ipLoginRateLimit };
