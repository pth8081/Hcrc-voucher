// Ho tro luong xac thuc hai yeu to (TOTP) BAT BUOC cho tai khoan quan tri - dung chung boi
// login.js, 2fa-setup.html, 2fa-verify.html. Token TAM (chua phai phien dang nhap day du)
// luu o sessionStorage (khong phai localStorage) va o 1 key rieng voi phien that, tranh nham
// lan voi session dang dung cho toan bo cac trang khac.
const PENDING_2FA_TOKEN_KEY = 'pendingTwoFactorToken';

function setPendingTwoFactorToken(token) {
  sessionStorage.setItem(PENDING_2FA_TOKEN_KEY, token);
}
function getPendingTwoFactorToken() {
  return sessionStorage.getItem(PENDING_2FA_TOKEN_KEY);
}
function clearPendingTwoFactorToken() {
  sessionStorage.removeItem(PENDING_2FA_TOKEN_KEY);
}

/**
 * Goi API 2FA - uu tien phien dang nhap day du neu da co (truong hop tu chon "doi thiet bi
 * 2FA" khi dang dung app binh thuong), nguoc lai dung token TAM (buoc thiet lap/xac minh ngay
 * sau dang nhap, khi CHUA co phien day du). Khong redirect ve /login.html khi loi nhu apiFetch,
 * vi trang nay CHINH LA 1 phan cua luong dang nhap.
 */
async function twoFaFetch(path, options = {}) {
  const token = (typeof getToken === 'function' && getToken()) || getPendingTwoFactorToken();
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    options.headers || {},
    token ? { Authorization: `Bearer ${token}` } : {}
  );
  const res = await fetch(`/api${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new Error(body.message || `Loi API (${res.status})`);
  }
  return body.data;
}

function twoFaSetupInit() {
  return twoFaFetch('/auth/2fa/setup-init', { method: 'POST' });
}
function twoFaSetupVerify(code) {
  return twoFaFetch('/auth/2fa/setup-verify', { method: 'POST', body: JSON.stringify({ code }) });
}
function twoFaLoginVerify(code) {
  return twoFaFetch('/auth/2fa/login-verify', { method: 'POST', body: JSON.stringify({ code }) });
}
