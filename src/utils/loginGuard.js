// Chan brute-force mat khau dang nhap. Khoa theo TEN DANG NHAP (khong phai theo IP/thiet
// bi) vi nhieu nhan vien dung chung 1 thiet bi tai quay - khoa theo IP se khoa nham ca
// nhung nguoi khac dang dung cung may.
const FAIL_THRESHOLD = 5;
const WINDOW_MS = 10 * 60 * 1000; // 10 phut
const LOCK_MS = 15 * 60 * 1000; // khoa 15 phut

const state = new Map(); // username (lowercase) -> { failCount, windowStart, lockedUntil }

function keyOf(username) {
  return String(username || '').trim().toLowerCase();
}

function assertNotLocked(username) {
  const key = keyOf(username);
  if (!key) return;
  const s = state.get(key);
  if (s && s.lockedUntil && Date.now() < s.lockedUntil) {
    const remainMin = Math.ceil((s.lockedUntil - Date.now()) / 60000);
    const err = new Error(
      `Tai khoan tam khoa dang nhap do sai mat khau qua nhieu lan. Thu lai sau ${remainMin} phut.`
    );
    err.statusCode = 429;
    err.publicMessage = err.message;
    throw err;
  }
}

function recordResult(username, success) {
  const key = keyOf(username);
  if (!key) return;
  const now = Date.now();
  let s = state.get(key);
  if (!s || now - s.windowStart > WINDOW_MS) {
    s = { failCount: 0, windowStart: now, lockedUntil: 0 };
  }

  if (success) {
    state.delete(key);
    return;
  }

  s.failCount += 1;
  if (s.failCount >= FAIL_THRESHOLD) {
    s.lockedUntil = now + LOCK_MS;
  }
  state.set(key, s);
}

module.exports = { assertNotLocked, recordResult };
