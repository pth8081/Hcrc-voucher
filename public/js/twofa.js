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
    const err = new Error(body.message || `Lỗi API (${res.status})`);
    // code/confirmToken: giong het api.js#apiFetch - de runLoginStep() ben duoi nhan dien duoc
    // loi SESSION_CONFLICT tu CA duong 2FA (xac minh ma luc dang nhap/thiet lap lan dau).
    err.code = body.code;
    err.confirmToken = body.confirmToken;
    throw err;
  }
  return body.data;
}

/** password: BAT BUOC khi doi thiet bi tu 1 phien day du da co san (server se tu choi neu
 * thieu) - khong can khi thiet lap lan dau (token tam, nguoi dung vua xac minh mat khau xong). */
function twoFaSetupInit(password) {
  return twoFaFetch('/auth/2fa/setup-init', { method: 'POST', body: JSON.stringify({ password }) });
}
function twoFaSetupVerify(code) {
  return twoFaFetch('/auth/2fa/setup-verify', { method: 'POST', body: JSON.stringify({ code }) });
}
function twoFaLoginVerify(code) {
  return twoFaFetch('/auth/2fa/login-verify', { method: 'POST', body: JSON.stringify({ code }) });
}
/** Hien lai QR cua secret HIEN TAI (khong doi secret) de quet them tren 1 thiet bi thu 2 - can
 * nhap lai mat khau de xac nhan. */
function twoFaShowQr(password) {
  return twoFaFetch('/auth/2fa/show-qr', { method: 'POST', body: JSON.stringify({ password }) });
}

/** Goi /auth/confirm-takeover BANG confirmToken rieng (KHONG phai phien/token tam 2FA dang co,
 * xem authService.js#sessionConflict) - khong dung apiFetch/twoFaFetch vi 2 ham do tu chon
 * token theo thu tu co san (getToken()/getPendingTwoFactorToken()), con o day BAT BUOC dung
 * DUNG confirmToken server vua cap kem loi SESSION_CONFLICT. */
async function confirmTakeoverFetch(confirmToken) {
  const res = await fetch('/api/auth/confirm-takeover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${confirmToken}` },
    body: JSON.stringify({}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new Error(body.message || `Lỗi API (${res.status})`);
  }
  return body.data;
}

/**
 * Dung CHUNG cho MOI buoc co the cap phien day du (dang nhap mat khau/van tay, xac minh 2FA,
 * thiet lap 2FA lan dau, doi mat khau bat buoc) - theo yeu cau nguoi dung: canh bao "tai khoan
 * co the dang dang nhap o noi khac" truoc khi thuc su cap phien (xem authService.js#sessionConflict).
 * `stepFn` la 1 ham async thuc hien dung buoc do (vd apiFetch('/auth/login', ...)). Neu buoc do
 * nem loi SESSION_CONFLICT (api.js da gan san err.code/err.confirmToken), hien hop thoai xac
 * nhan - dong y thi goi /auth/confirm-takeover de HOAN TAT dang nhap NGAY (khong can lam lai
 * buoc xac thuc, vi captcha/ma 2FA/chu ky van tay deu CHI dung duoc 1 LAN, goi lai se loi).
 * Tra ve: du lieu phien (truyen thang cho continueAfterPrimaryAuth) neu khong xung dot HOAC da
 * dong y ghi de; null neu nguoi dung bam Huy (noi goi phai dung lai, khong lam gi them).
 */
async function runLoginStep(stepFn) {
  try {
    return await stepFn();
  } catch (err) {
    if (err.code !== 'SESSION_CONFLICT') throw err;
    if (!window.confirm(err.message + '\n\nBạn có muốn tiếp tục?')) return null;
    return confirmTakeoverFetch(err.confirmToken);
  }
}

/**
 * Dieu huong sau khi xac minh danh tinh chinh (mat khau hoac van tay/Face ID) THANH CONG, VA
 * sau khi doi mat khau bat buoc xong (server co the tra ve tiep buoc 2FA hoac phien day du) -
 * dung chung boi login.js va change-password.js. Thu tu cac buoc: doi mat khau bat buoc (moi
 * tai khoan) -> 2FA (chi quan tri) -> phien day du.
 */
function continueAfterPrimaryAuth(data) {
  if (data.passwordChange === 'required') {
    setPendingTwoFactorToken(data.pendingToken);
    window.location.href = '/change-password.html';
    return;
  }
  if (data.twoFactor === 'setup_required') {
    setPendingTwoFactorToken(data.pendingToken);
    window.location.href = '/2fa-setup.html';
    return;
  }
  if (data.twoFactor === 'verify_required') {
    setPendingTwoFactorToken(data.pendingToken);
    window.location.href = '/2fa-verify.html';
    return;
  }
  setSession(data.token, data.user);
  window.location.href = '/index.html';
}
