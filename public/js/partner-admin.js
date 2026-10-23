requireAuth();
renderTopbar('partner-admin');

const notAllowedNotice = document.getElementById('notAllowedNotice');
const partnerAdminCard = document.getElementById('partnerAdminCard');
const partnerAdminTitle = document.getElementById('partnerAdminTitle');
const listBody = document.getElementById('listBody');
const createForm = document.getElementById('createForm');
const createBtn = document.getElementById('createBtn');

const STATE_CHIP = {
  active: '<span class="status-badge status-unused">ĐANG HOẠT ĐỘNG</span>',
  not_yet_active: '<span class="status-badge status-other">CHƯA KÍCH HOẠT</span>',
  expired: '<span class="status-badge status-used">ĐÃ HẾT HẠN</span>',
};

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function load() {
  try {
    const user = getUser();
    const connectionName = (user && user.permissions && user.permissions.partnerAdminConnectionName) || '';
    partnerAdminTitle.textContent = connectionName ? `Quản trị đối tác - Hệ thống ${connectionName}` : 'Quản trị đối tác';

    const rows = await apiFetch('/partner-admin/users');
    renderList(rows);
  } catch (err) {
    notAllowedNotice.classList.remove('hidden');
    partnerAdminCard.classList.add('hidden');
  }
}

function renderList(rows) {
  if (!rows.length) {
    listBody.innerHTML = '<tr><td colspan="4" class="text-muted">Chưa có tài khoản nào - tạo mới ở form bên trên</td></tr>';
    return;
  }
  listBody.innerHTML = rows
    .map((u) => {
      const stateLabel = u.isDeleted ? '<span class="status-badge status-used">ĐÃ KHÓA</span>' : STATE_CHIP[u.state] || '';
      const actionLabel = u.isDeleted ? 'Mở khóa' : 'Khóa';
      const actionClass = u.isDeleted ? 'btn-secondary' : 'btn-danger';
      return `
      <tr data-user-id="${u.userId}" data-username="${escapeHtml(u.username)}">
        <td data-label="Tên đăng nhập">${escapeHtml(u.username)}</td>
        <td data-label="Họ tên">${escapeHtml(u.fullName || '')}</td>
        <td data-label="Trạng thái">${stateLabel}</td>
        <td data-label="Hành động">
          <button type="button" class="${actionClass} toggle-active-btn">${actionLabel}</button>
        </td>
      </tr>`;
    })
    .join('');

  listBody.querySelectorAll('tr[data-user-id]').forEach((tr) => {
    tr.querySelector('.toggle-active-btn').addEventListener('click', () => toggleActive(tr));
  });
}

async function toggleActive(tr) {
  const userId = tr.dataset.userId;
  const username = tr.dataset.username;
  const isCurrentlyLocked = tr.querySelector('.toggle-active-btn').textContent.trim() === 'Mở khóa';
  const isDeleted = !isCurrentlyLocked;
  const confirmMsg = isDeleted
    ? `Khóa tài khoản "${username}"? Tài khoản sẽ không đăng nhập được nữa - có thể mở khóa lại sau.`
    : `Mở khóa tài khoản "${username}"?`;
  if (!confirm(confirmMsg)) return;

  const btn = tr.querySelector('.toggle-active-btn');
  btn.disabled = true;
  try {
    await apiFetch(`/partner-admin/users/${encodeURIComponent(userId)}/active`, {
      method: 'PUT',
      body: JSON.stringify({ isDeleted, username }),
    });
    showToast(isDeleted ? `Đã khóa tài khoản "${username}"` : `Đã mở khóa tài khoản "${username}"`);
    load();
  } catch (err) {
    showToast(err.message);
    btn.disabled = false;
  }
}

createForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newPassword').value;
  const fullName = document.getElementById('newFullName').value.trim();

  createBtn.disabled = true;
  try {
    await apiFetch('/partner-admin/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, fullName }),
    });
    showToast(`Đã tạo tài khoản "${username}"`);
    createForm.reset();
    load();
  } catch (err) {
    showToast(err.message);
  } finally {
    createBtn.disabled = false;
  }
});

load();
