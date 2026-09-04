// Chan brute-force dang nhap (mat khau, van tay/Face ID, va ma xac thuc hai yeu to). Khoa
// theo TEN DANG NHAP (khong phai theo IP/thiet bi) vi nhieu nhan vien dung chung 1 thiet bi
// tai quay - khoa theo IP se khoa nham ca nhung nguoi khac dang dung cung may.
//
// Tai khoan quan tri (role='admin') dung nguong RIENG, long hon nhieu so voi nhan vien:
// xac thuc hai yeu to (TOTP) da la lop chan chinh cho admin - do sai mat khau/van tay hay
// ma OTP toi 50 lan thuc te khong tang rui ro dang ke (van con phai dung ca TOTP moi vao
// duoc), trong khi nguong thap 5 lan/khoa 15 phut lai de bi loi dung thanh DoS nguoc lai
// chinh admin (ai biet username admin chi can go sai 5 lan la khoa duoc ho lien tuc).
// Nhan vien khong co lop 2FA nen GIU NGUYEN nguong nghiem ngat nhu truoc.
const POLICY = {
  admin: { failThreshold: 50, windowMs: 15 * 60 * 1000, lockMs: 2 * 60 * 1000 },
  staff: { failThreshold: 5, windowMs: 10 * 60 * 1000, lockMs: 15 * 60 * 1000 },
};

const state = new Map(); // username (lowercase) -> { failCount, windowStart, lockedUntil, role }

function keyOf(username) {
  return String(username || '').trim().toLowerCase();
}

function policyFor(role) {
  return POLICY[role] || POLICY.staff;
}

function assertNotLocked(username) {
  const key = keyOf(username);
  if (!key) return;
  const s = state.get(key);
  if (s && s.lockedUntil && Date.now() < s.lockedUntil) {
    const remainMin = Math.ceil((s.lockedUntil - Date.now()) / 60000);
    const err = new Error(
      `Tai khoan tam khoa dang nhap do sai qua nhieu lan. Thu lai sau ${remainMin} phut.`
    );
    err.statusCode = 429;
    err.publicMessage = err.message;
    throw err;
  }
}

/**
 * @param {string} username
 * @param {boolean} success
 * @param {'admin'|'staff'} [role] - vai tro cua tai khoan NEU DA BIET (thuong co san vi da
 *   doc duoc ban ghi Users truoc do). Bo qua (username chua tung thay hoac chua ro vai tro)
 *   se mac dinh dung chinh sach 'staff' - nghiem ngat hon, an toan hon khi chua chac chan.
 */
function recordResult(username, success, role) {
  const key = keyOf(username);
  if (!key) return;

  if (success) {
    state.delete(key);
    return;
  }

  const now = Date.now();
  let s = state.get(key);
  const effectiveRole = role || (s && s.role) || 'staff';
  const policy = policyFor(effectiveRole);

  if (!s || now - s.windowStart > policy.windowMs) {
    s = { failCount: 0, windowStart: now, lockedUntil: 0, role: effectiveRole };
  } else {
    s.role = effectiveRole;
  }

  s.failCount += 1;
  if (s.failCount >= policy.failThreshold) {
    s.lockedUntil = now + policy.lockMs;
  }
  state.set(key, s);
}

module.exports = { assertNotLocked, recordResult };
