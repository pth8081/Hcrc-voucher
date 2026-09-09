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
    showToast('Vui long nhap mat khau');
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
    passkeyList.innerHTML = '<p class="text-muted">Chua dang ky thiet bi nao.</p>';
    return;
  }
  passkeyList.innerHTML = devices
    .map(
      (d) => `
      <div class="passkey-row" data-id="${d.Id}">
        <div>
          <div class="passkey-name">${escapeHtmlLayout(d.DeviceLabel || 'Thiet bi khong ten')}</div>
          <div class="text-muted fs-13">Dang ky luc: ${fmtDate(d.CreatedDate)}${d.LastUsedDate ? ' &middot; Dung gan nhat: ' + fmtDate(d.LastUsedDate) : ''}</div>
        </div>
        <button class="btn-danger" data-remove-id="${d.Id}" type="button">Go</button>
      </div>`
    )
    .join('');

  passkeyList.querySelectorAll('button[data-remove-id]').forEach((btn) => {
    btn.addEventListener('click', () => removePasskeyDevice(btn.dataset.removeId));
  });
}

async function removePasskeyDevice(id) {
  if (!window.confirm('Go thiet bi nay? Thiet bi se khong con dang nhap duoc bang van tay/Face ID nua.')) return;
  try {
    await removePasskey(id);
    showToast('Da go thiet bi');
    loadPasskeys();
  } catch (err) {
    showToast(err.message);
  }
}

passkeyRegisterBtn.addEventListener('click', async () => {
  if (!webauthnSupported()) {
    showToast('Trinh duyet nay khong ho tro dang ky van tay/Face ID.');
    return;
  }
  passkeyRegisterBtn.disabled = true;
  try {
    await registerPasskey(passkeyLabel.value.trim() || null);
    passkeyLabel.value = '';
    showToast('Da dang ky thiet bi nay');
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
      ? `Da bat - kich hoat luc ${fmtDate(status.enabledDate)}${status.lastUsedDate ? ', dung gan nhat ' + fmtDate(status.lastUsedDate) : ''}`
      : 'Chua thiet lap - can mot quan tri vien khac go giup neu ban tung bi khoa thiet bi.';
    changeDeviceBtn.classList.remove('hidden');
    changeDeviceBtn.textContent = status.enabled ? 'Doi thiet bi xac thuc' : 'Thiet lap ngay';
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
        ? '<span class="status-badge status-unused">DA BAT</span>'
        : '<span class="status-badge status-other">CHUA BAT</span>';
      const actionCell = isSelf
        ? '<span class="text-muted fs-13">Tai khoan cua ban</span>'
        : `<button class="btn-danger" data-user-id="${a.userId}" data-username="${escapeHtmlLayout(a.username)}" ${a.twoFactorEnabled ? '' : 'disabled'}>Go 2FA</button>`;
      return `
        <tr class="${isSelf ? 'self-row' : ''}">
          <td data-label="Ten dang nhap">${escapeHtmlLayout(a.username)}</td>
          <td data-label="Ho ten">${escapeHtmlLayout(a.fullName || '-')}</td>
          <td data-label="Trang thai 2FA">${statusBadge}</td>
          <td data-label="Kich hoat luc">${fmtDate(a.enabledDate)}</td>
          <td data-label="Dung gan nhat">${fmtDate(a.lastUsedDate)}</td>
          <td data-label="Hanh dong">${actionCell}</td>
        </tr>`;
    })
    .join('');

  adminsBody.querySelectorAll('button[data-user-id]').forEach((btn) => {
    btn.addEventListener('click', () => resetAdmin(btn.dataset.userId, btn.dataset.username));
  });
}

async function resetAdmin(userId, username) {
  const confirmed = window.confirm(
    `Go xac thuc hai yeu to cua "${username}"? Nguoi nay se phai thiet lap lai tu dau o lan dang nhap ke tiep.`
  );
  if (!confirmed) return;

  try {
    await apiFetch(`/auth/2fa/admins/${encodeURIComponent(userId)}`, { method: 'DELETE' });
    showToast(`Da go xac thuc hai yeu to cua ${username}`);
    load();
  } catch (err) {
    showToast(err.message);
  }
}

loadPasskeys();
load();
