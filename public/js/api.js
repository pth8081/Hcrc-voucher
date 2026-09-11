const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

function setSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    options.headers || {},
    token ? { Authorization: `Bearer ${token}` } : {}
  );

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearSession();
    window.location.href = '/login.html';
    throw new Error('Phien dang nhap het han');
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new Error(body.message || `Loi API (${res.status})`);
  }
  return body.data;
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = '/login.html';
  }
}

function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// M2: cac form xac thuc (dang nhap, 2FA, doi mat khau) truoc day khong khoa nut trong luc dang
// cho phan hoi - bam nhanh 2 lan (mang cham, hoac vo y) gui 2 request song song, co the tinh
// nham 2 lan sai vao bo dem khoa (loginGuard/guessGuard) hoac dot 1 ma 2FA/captcha dung lan
// 2 truoc khi lan 1 kip xu ly xong. Khoa nut submit ngay khi bam, chi mo lai sau khi xong
// (thanh cong hay loi deu mo lai, tru khi dang chuyen trang).
async function withSubmitLock(form, fn) {
  const btn = form.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;
  try {
    await fn();
  } finally {
    if (btn) btn.disabled = false;
  }
}

function fmtMoney(v) {
  if (v === null || v === undefined) return '-';
  return Number(v).toLocaleString('vi-VN') + ' d';
}

function fmtDate(v) {
  if (!v) return '-';
  const d = new Date(v);
  // H10: KHONG duoc tra ve nguyen van gia tri tho khi khong parse duoc ngay - gia tri nay co
  // the den tu Core API (issueDate/expiryDate, qua mapping do admin tu cau hinh) va bi chen
  // thang vao innerHTML o vai noi (scan.js, api-connection.js) ma khong qua escapeHtml, tao
  // XSS neu Core (hoac 1 ket noi bi cau hinh sai/gia mao) tra ve chuoi chua the HTML.
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('vi-VN');
}
