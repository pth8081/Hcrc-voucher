// Chan do "go linh tinh"/brute-force ma voucher qua API (khong the tin tuong hoan toan vao
// gioi han o frontend vi ai co token deu co the goi thang API bang curl/Postman).
// Dem so lan kiem tra KHONG hop le (NOT_FOUND/ERROR) lien tiep cua tung nguoi dung; qua
// nguong trong 1 khoang thoi gian thi tam khoa nguoi do khong cho kiem tra tiep.

const FAIL_THRESHOLD = 5;
const WINDOW_MS = 60 * 1000; // 1 phut
const LOCK_MS = 2 * 60 * 1000; // khoa 2 phut

const state = new Map(); // userId -> { failCount, windowStart, lockedUntil }

function assertNotLocked(userId) {
  const s = state.get(userId);
  if (s && s.lockedUntil && Date.now() < s.lockedUntil) {
    const remainSec = Math.ceil((s.lockedUntil - Date.now()) / 1000);
    const err = new Error(
      `Tai khoan tam khoa quet voucher do co qua nhieu lan kiem tra khong hop le. Thu lai sau ${remainSec} giay.`
    );
    err.statusCode = 429;
    err.publicMessage = err.message;
    throw err;
  }
}

/** valid = true neu voucher CO TON TAI tren Core system (du da tieu hay chua) - tuc la 1 lan quet that. */
function recordResult(userId, valid) {
  if (userId === undefined || userId === null) return;
  const now = Date.now();
  let s = state.get(userId);
  if (!s || now - s.windowStart > WINDOW_MS) {
    s = { failCount: 0, windowStart: now, lockedUntil: 0 };
  }

  if (valid) {
    s.failCount = 0;
  } else {
    s.failCount += 1;
    if (s.failCount >= FAIL_THRESHOLD) {
      s.lockedUntil = now + LOCK_MS;
    }
  }
  state.set(userId, s);
}

module.exports = { assertNotLocked, recordResult };
