requireAuth();
renderTopbar('security');

const notAdminNotice = document.getElementById('notAdminNotice');
const securityCards = document.getElementById('securityCards');
const myStatusEl = document.getElementById('myStatus');
const changeDeviceBtn = document.getElementById('changeDeviceBtn');
const adminsBody = document.getElementById('adminsBody');

const showQrBtn = document.getElementById('showQrBtn');
const showQrPanel = document.getElementById('showQrPanel');
const showQrPassword = document.getElementById('showQrPassword');
const showQrConfirmBtn = document.getElementById('showQrConfirmBtn');
const showQrResult = document.getElementById('showQrResult');
const showQrImg = document.getElementById('showQrImg');
const showQrKey = document.getElementById('showQrKey');

const passkeyList = document.getElementById('passkeyList');
const passkeyLabel = document.getElementById('passkeyLabel');
const passkeyRegisterBtn = document.getElementById('passkeyRegisterBtn');

const currentUser = getUser();

changeDeviceBtn.addEventListener('click', () => {
  window.location.href = '/2fa-setup.html';
});

showQrBtn.addEventListener('click', () => {
  showQrPanel.classList.toggle('hidden');
});

showQrConfirmBtn.addEventListener('click', async () => {
  const password = showQrPassword.value;
  if (!password) {
    showToast('Vui lòng nhập mật khẩu');
    return;
  }
  showQrConfirmBtn.disabled = true;
  try {
    const data = await twoFaShowQr(password);
    showQrImg.src = data.qrCodeDataUrl;
    showQrKey.textContent = data.manualEntryKey;
    showQrResult.classList.remove('hidden');
    showQrPassword.value = '';
  } catch (err) {
    showToast(err.message);
  } finally {
    showQrConfirmBtn.disabled = false;
  }
});

// ===== Van tay / Face ID (moi tai khoan, khong rieng quan tri) =====

async function loadPasskeys() {
  try {
    const devices = await listPasskeys();
    renderPasskeys(devices);
  } catch (err) {
    passkeyList.innerHTML = `<p class="warn-inline">${escapeHtmlLayout(err.message)}</p>`;
  }
}

function renderPasskeys(devices) {
  if (!devices.length) {
    passkeyList.innerHTML = '<p class="text-muted">Chưa đăng ký thiết bị nào.</p>';
    return;
  }
  passkeyList.innerHTML = devices
    .map(
      (d) => `
      <div class="passkey-row" data-id="${d.Id}">
        <div>
          <div class="passkey-name">${escapeHtmlLayout(d.DeviceLabel || 'Thiết bị không tên')}</div>
          <div class="text-muted fs-13">Đăng ký lúc: ${fmtDate(d.CreatedDate)}${d.LastUsedDate ? ' &middot; Dùng gần nhất: ' + fmtDate(d.LastUsedDate) : ''}</div>
        </div>
        <button class="btn-danger" data-remove-id="${d.Id}" type="button">Gỡ</button>
      </div>`
    )
    .join('');

  passkeyList.querySelectorAll('button[data-remove-id]').forEach((btn) => {
    btn.addEventListener('click', () => removePasskeyDevice(btn.dataset.removeId));
  });
}

async function removePasskeyDevice(id) {
  if (!window.confirm('Gỡ thiết bị này? Thiết bị sẽ không còn đăng nhập được bằng vân tay/Face ID nữa.')) return;
  try {
    await removePasskey(id);
    showToast('Đã gỡ thiết bị');
    loadPasskeys();
  } catch (err) {
    showToast(err.message);
  }
}

passkeyRegisterBtn.addEventListener('click', async () => {
  if (!webauthnSupported()) {
    showToast('Trình duyệt này không hỗ trợ đăng ký vân tay/Face ID.');
    return;
  }
  passkeyRegisterBtn.disabled = true;
  try {
    await registerPasskey(passkeyLabel.value.trim() || null);
    passkeyLabel.value = '';
    showToast('Đã đăng ký thiết bị này');
    loadPasskeys();
  } catch (err) {
    showToast(err.message);
  } finally {
    passkeyRegisterBtn.disabled = false;
  }
});

// ===== Xac thuc hai yeu to (chi quan tri) =====

async function load() {
  try {
    const status = await apiFetch('/auth/2fa/status');
    myStatusEl.textContent = status.enabled
      ? `Đã bật - kích hoạt lúc ${fmtDate(status.enabledDate)}${status.lastUsedDate ? ', dùng gần nhất ' + fmtDate(status.lastUsedDate) : ''}`
      : 'Chưa thiết lập - cần một quản trị viên khác gỡ giúp nếu bạn từng bị khóa thiết bị.';
    changeDeviceBtn.classList.remove('hidden');
    changeDeviceBtn.textContent = status.enabled ? 'Đổi thiết bị xác thực' : 'Thiết lập ngay';
    showQrBtn.classList.toggle('hidden', !status.enabled);

    const admins = await apiFetch('/auth/2fa/admins');
    renderAdmins(admins);
  } catch (err) {
    notAdminNotice.classList.remove('hidden');
    securityCards.classList.add('hidden');
  }
}

function renderAdmins(admins) {
  adminsBody.innerHTML = admins
    .map((a) => {
      const isSelf = currentUser && Number(currentUser.userId) === Number(a.userId);
      const statusBadge = a.twoFactorEnabled
        ? '<span class="status-badge status-unused">ĐÃ BẬT</span>'
        : '<span class="status-badge status-other">CHƯA BẬT</span>';
      const actionCell = isSelf
        ? '<span class="text-muted fs-13">Tài khoản của bạn</span>'
        : `<button class="btn-danger" data-user-id="${a.userId}" data-username="${escapeHtmlLayout(a.username)}" ${a.twoFactorEnabled ? '' : 'disabled'}>Gỡ 2FA</button>`;
      return `
        <tr class="${isSelf ? 'self-row' : ''}">
          <td data-label="Tên đăng nhập">${escapeHtmlLayout(a.username)}</td>
          <td data-label="Họ tên">${escapeHtmlLayout(a.fullName || '-')}</td>
          <td data-label="Trạng thái 2FA">${statusBadge}</td>
          <td data-label="Kích hoạt lúc">${fmtDate(a.enabledDate)}</td>
          <td data-label="Dùng gần nhất">${fmtDate(a.lastUsedDate)}</td>
          <td data-label="Hành động">${actionCell}</td>
        </tr>`;
    })
    .join('');

  adminsBody.querySelectorAll('button[data-user-id]').forEach((btn) => {
    btn.addEventListener('click', () => resetAdmin(btn.dataset.userId, btn.dataset.username));
  });
}

async function resetAdmin(userId, username) {
  const confirmed = window.confirm(
    `Gỡ xác thực hai yếu tố của "${username}"? Người này sẽ phải thiết lập lại từ đầu ở lần đăng nhập kế tiếp.`
  );
  if (!confirmed) return;

  try {
    await apiFetch(`/auth/2fa/admins/${encodeURIComponent(userId)}`, { method: 'DELETE' });
    showToast(`Đã gỡ xác thực hai yếu tố của ${username}`);
    load();
  } catch (err) {
    showToast(err.message);
  }
}

loadPasskeys();
load();
