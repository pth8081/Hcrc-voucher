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

const PERM_FIELDS = ['canRedeemVoucher', 'canViewReconciliation', 'canViewSummary', 'canViewUsedVouchers'];

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

function permCheckbox(field, checked, isAdmin) {
  return `<input type="checkbox" class="perm-${field}" ${checked ? 'checked' : ''} ${isAdmin ? 'disabled' : ''} />`;
}

function renderUsers(users) {
  const groupOptions = accessGroupsCache
    .map((g) => `<option value="${g.Id}">${escapeHtmlLayout(g.GroupName)}</option>`)
    .join('');

  usersBody.innerHTML = users
    .map((u) => {
      const isAdmin = Number(u.role) === 1;
      const perms = u.permissions || {};
      return `
      <tr data-user-id="${u.userId}" data-username="${escapeHtmlLayout(u.username)}">
        <td>${escapeHtmlLayout(u.username)}</td>
        <td>${escapeHtmlLayout(u.fullName || '-')}</td>
        <td>${isAdmin ? 'Quan tri' : 'Nhan vien'}</td>
        <td class="perm-cell">${permCheckbox('canRedeemVoucher', perms.canRedeemVoucher, isAdmin)}</td>
        <td class="perm-cell">${permCheckbox('canViewReconciliation', perms.canViewReconciliation, isAdmin)}</td>
        <td class="perm-cell">${permCheckbox('canViewSummary', perms.canViewSummary, isAdmin)}</td>
        <td class="perm-cell">${permCheckbox('canViewUsedVouchers', perms.canViewUsedVouchers, isAdmin)}</td>
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
      </tr>`;
    })
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
  const username = tr.dataset.username;
  const activeFrom = fromLocalInputValue(tr.querySelector('.active-from').value);
  const activeUntil = fromLocalInputValue(tr.querySelector('.active-until').value);
  const groupIdRaw = tr.querySelector('.report-access-group').value;
  const groupId = groupIdRaw ? Number(groupIdRaw) : null;
  const permissions = {};
  PERM_FIELDS.forEach((field) => {
    const el = tr.querySelector(`.perm-${field}`);
    permissions[field] = !!(el && el.checked);
  });

  const saveBtn = tr.querySelector('.save-btn');
  saveBtn.disabled = true;

  const jobs = [
    {
      label: 'Lich hieu luc',
      run: () => apiFetch(`/users/${encodeURIComponent(userId)}/schedule`, {
        method: 'PUT',
        body: JSON.stringify({ activeFrom, activeUntil, username }),
      }),
    },
    {
      label: 'Nhom quyen bao cao',
      run: () => apiFetch(`/users/${encodeURIComponent(userId)}/report-access`, {
        method: 'PUT',
        body: JSON.stringify({ groupId, username }),
      }),
    },
    {
      label: 'Quyen tinh nang',
      run: () => apiFetch(`/users/${encodeURIComponent(userId)}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ ...permissions, username }),
      }),
    },
  ];

  try {
    const results = await Promise.allSettled(jobs.map((j) => j.run()));
    const failed = results
      .map((r, i) => ({ r, label: jobs[i].label }))
      .filter((x) => x.r.status === 'rejected');

    if (!failed.length) {
      showToast('Da luu tai khoan');
    } else if (failed.length === jobs.length) {
      showToast(`Luu that bai toan bo: ${failed[0].r.reason.message}`);
    } else {
      const names = failed.map((x) => x.label).join(', ');
      showToast(`Loi khi luu: ${names} (${failed[0].r.reason.message}). Cac muc con lai da luu.`);
    }
  } finally {
    saveBtn.disabled = false;
    load();
  }
}

const createUserBtn = document.getElementById('createUserBtn');
createUserBtn.addEventListener('click', async () => {
  const username = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newPassword').value;
  const fullName = document.getElementById('newFullName').value.trim();
  const role = document.getElementById('newRole').value;
  const locationsGroup = document.getElementById('newLocationsGroup').value.trim() || null;
  const locationsDetail = document.getElementById('newLocationsDetail').value.trim() || null;

  createUserBtn.disabled = true;
  try {
    await apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, fullName, role: Number(role), locationsGroup, locationsDetail }),
    });
    showToast(`Da tao tai khoan "${username}"`);
    document.getElementById('newUsername').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('newFullName').value = '';
    document.getElementById('newLocationsGroup').value = '';
    document.getElementById('newLocationsDetail').value = '';
    load();
  } catch (err) {
    showToast(err.message);
  } finally {
    createUserBtn.disabled = false;
  }
});

load();
