requireAuth();
renderTopbar('security');

const notAdminNotice = document.getElementById('notAdminNotice');
const securityCards = document.getElementById('securityCards');
const myStatusEl = document.getElementById('myStatus');
const changeDeviceBtn = document.getElementById('changeDeviceBtn');
const adminsBody = document.getElementById('adminsBody');

const currentUser = getUser();

changeDeviceBtn.addEventListener('click', () => {
  window.location.href = '/2fa-setup.html';
});

async function load() {
  try {
    const status = await apiFetch('/auth/2fa/status');
    myStatusEl.textContent = status.enabled
      ? `Da bat - kich hoat luc ${fmtDate(status.enabledDate)}${status.lastUsedDate ? ', dung gan nhat ' + fmtDate(status.lastUsedDate) : ''}`
      : 'Chua thiet lap - can mot quan tri vien khac go giup neu ban tung bi khoa thiet bi.';
    changeDeviceBtn.classList.remove('hidden');
    changeDeviceBtn.textContent = status.enabled ? 'Doi thiet bi xac thuc' : 'Thiet lap ngay';

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
          <td>${escapeHtmlLayout(a.username)}</td>
          <td>${escapeHtmlLayout(a.fullName || '-')}</td>
          <td>${statusBadge}</td>
          <td>${fmtDate(a.enabledDate)}</td>
          <td>${fmtDate(a.lastUsedDate)}</td>
          <td>${actionCell}</td>
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

load();
