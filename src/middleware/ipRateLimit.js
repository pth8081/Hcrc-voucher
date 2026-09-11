// H2: loginGuard.js chi khoa theo TEN DANG NHAP (co chu dich, xem ghi chu o do) - nen hoan
// toan "mu" truoc kieu tan cong "password spraying" (thu 1-2 mat khau pho bien tren RAT NHIEU
// tai khoan khac nhau tu 1 nguon), vi khong tai khoan nao rieng le vuot nguong khoa. Middleware
// nay them 1 lop CHAN THEO DIA CHI IP, doc lap voi loginGuard, ap dung cho cac endpoint nhap
// thong tin xac thuc (dang nhap, xac minh 2FA, dang nhap van tay). Nguong rong rai (khong phai
// de thay the loginGuard, chi de chan spam/spray quy mo lon tu 1 nguon).
const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS = 30;

const state = new Map(); // ip -> { count, windowStart }

function ipLoginRateLimit(req, res, next) {
  const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
  const now = Date.now();
  let s = state.get(ip);
  if (!s || now - s.windowStart > WINDOW_MS) {
    s = { count: 0, windowStart: now };
  }
  s.count += 1;
  state.set(ip, s);

  if (s.count > MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      message: 'Qua nhieu yeu cau dang nhap tu mang nay trong thoi gian ngan, vui long thu lai sau it phut.',
    });
  }
  return next();
}

module.exports = { ipLoginRateLimit };
