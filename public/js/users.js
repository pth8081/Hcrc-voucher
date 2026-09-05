requireAuth();
renderTopbar('users');

const notAdminNotice = document.getElementById('notAdminNotice');
const usersCard = document.getElementById('usersCard');
const usersBody = document.getElementById('usersBody');

const STATE_CHIP = {
  active: '<span class="status-badge status-unused">DANG HOAT DONG</span>',
  not_yet_active: '<span class="status-badge status-other">CHUA KICH HOAT</span>',
  expired: '<span class="status-badge status-used">DA HET HAN</span>',
};

/** ISO string (hoac null) -> gia tri cho input[type=datetime-local] (gio dia phuong). */
function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Gia tri tu input[type=datetime-local] -> ISO string hoac null neu de trong. */
function fromLocalInputValue(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

let accessGroupsCache = [];

async function load() {
  try {
    const [users, groups] = await Promise.all([
      apiFetch('/users'),
      apiFetch('/access-groups').catch(() => []),
    ]);
    accessGroupsCache = groups;
    renderUsers(users);
  } catch (err) {
    notAdminNotice.classList.remove('hidden');
    usersCard.classList.add('hidden');
  }
}

function renderUsers(users) {
  const groupOptions = accessGroupsCache
    .map((g) => `<option value="${g.Id}">${escapeHtmlLayout(g.GroupName)}</option>`)
    .join('');

  usersBody.innerHTML = users
    .map(
      (u) => `
      <tr data-user-id="${u.userId}">
        <td>${escapeHtmlLayout(u.username)}</td>
        <td>${escapeHtmlLayout(u.fullName || '-')}</td>
        <td>${Number(u.role) === 1 ? 'Quan tri' : 'Nhan vien'}</td>
        <td><input type="datetime-local" class="active-from" value="${toLocalInputValue(u.activeFrom)}" /></td>
        <td><input type="datetime-local" class="active-until" value="${toLocalInputValue(u.activeUntil)}" /></td>
        <td class="state-cell">${STATE_CHIP[u.state] || ''}</td>
        <td>
          <select class="report-access-group">
            <option value="">Mac dinh (chi cong ty cua minh)</option>
            ${groupOptions}
          </select>
        </td>
        <td><button class="btn-secondary save-btn" type="button">Luu</button></td>
      </tr>`
    )
    .join('');

  usersBody.querySelectorAll('tr[data-user-id]').forEach((tr) => {
    const userId = tr.dataset.userId;
    const user = users.find((u) => String(u.userId) === String(userId));
    if (user && user.reportAccessGroupId) {
      tr.querySelector('.report-access-group').value = String(user.reportAccessGroupId);
    }
    tr.querySelector('.save-btn').addEventListener('click', () => saveUser(tr));
  });
}

async function saveUser(tr) {
  const userId = tr.dataset.userId;
  const activeFrom = fromLocalInputValue(tr.querySelector('.active-from').value);
  const activeUntil = fromLocalInputValue(tr.querySelector('.active-until').value);
  const groupIdRaw = tr.querySelector('.report-access-group').value;
  const groupId = groupIdRaw ? Number(groupIdRaw) : null;

  try {
    await Promise.all([
      apiFetch(`/users/${encodeURIComponent(userId)}/schedule`, {
        method: 'PUT',
        body: JSON.stringify({ activeFrom, activeUntil }),
      }),
      apiFetch(`/users/${encodeURIComponent(userId)}/report-access`, {
        method: 'PUT',
        body: JSON.stringify({ groupId }),
      }),
    ]);
    showToast('Da luu tai khoan');
    load();
  } catch (err) {
    showToast(err.message);
  }
}

load();
