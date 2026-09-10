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
let companiesCache = [];
let redemptionUnitsCache = [];

const PERM_FIELDS = ['canRedeemVoucher', 'canViewReconciliation', 'canViewSummary', 'canViewUsedVouchers'];
const showDeletedCheckbox = document.getElementById('showDeletedCheckbox');

async function load() {
  try {
    const includeDeleted = showDeletedCheckbox.checked ? 'true' : 'false';
    const [users, groups, companies, units] = await Promise.all([
      apiFetch(`/users?includeDeleted=${includeDeleted}`),
      apiFetch('/access-groups').catch(() => []),
      apiFetch('/companies').catch(() => []),
      apiFetch('/redemption-units').catch(() => []),
    ]);
    accessGroupsCache = groups;
    companiesCache = companies;
    redemptionUnitsCache = units;
    renderNewCompanyOptions();
    renderUsers(users);
  } catch (err) {
    notAdminNotice.classList.remove('hidden');
    usersCard.classList.add('hidden');
  }
}
showDeletedCheckbox.addEventListener('change', load);

/** Nhan dien nhanh: "CompanyName - PartnerName (LocationCode)" - du de phan biet cac diem tieu
 * trung ten o cong ty khac nhau, ma van gon trong 1 dropdown. */
function unitLabel(u) {
  const company = u.CompanyName ? escapeHtmlLayout(u.CompanyName) : 'Chua gan cong ty';
  return `${company} - ${escapeHtmlLayout(u.PartnerName)} (${escapeHtmlLayout(u.LocationCode)})`;
}

function redemptionUnitOptions(filterCompanyId) {
  const list = filterCompanyId
    ? redemptionUnitsCache.filter((u) => String(u.CompanyId) === String(filterCompanyId))
    : redemptionUnitsCache;
  return list.map((u) => `<option value="${u.Id}">${unitLabel(u)}</option>`).join('');
}

function renderNewCompanyOptions() {
  const select = document.getElementById('newCompanyId');
  select.innerHTML =
    '<option value="">-- Chua gan cong ty --</option>' +
    companiesCache.map((c) => `<option value="${c.Id}">${escapeHtmlLayout(c.CompanyName)}</option>`).join('');
}

function refreshNewRedemptionUnitOptions() {
  const companyId = document.getElementById('newCompanyId').value;
  const select = document.getElementById('newRedemptionUnitId');
  if (!companyId) {
    select.innerHTML = '<option value="">-- Chon cong ty truoc --</option>';
    return;
  }
  const opts = redemptionUnitOptions(companyId);
  select.innerHTML = opts
    ? `<option value="">-- Khong gan diem tieu --</option>${opts}`
    : '<option value="">-- Cong ty nay chua co diem tieu nao --</option>';
}
document.getElementById('newCompanyId').addEventListener('change', refreshNewRedemptionUnitOptions);

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
      const deleted = !!u.isDeleted;
      return `
      <tr data-user-id="${u.userId}" data-username="${escapeHtmlLayout(u.username)}" class="${deleted ? 'row-deleted' : ''}">
        <td data-label="Ten dang nhap">${escapeHtmlLayout(u.username)}${deleted ? ' <span class="status-badge status-used">DA XOA</span>' : ''}</td>
        <td data-label="Ho ten"><input class="edit-fullname" value="${escapeHtmlLayout(u.fullName || '')}" /></td>
        <td data-label="Vai tro">${isAdmin ? 'Quan tri' : 'Nhan vien'}</td>
        <td class="perm-cell" data-label="Thu hoi">${permCheckbox('canRedeemVoucher', perms.canRedeemVoucher, isAdmin)}</td>
        <td class="perm-cell" data-label="Doi soat">${permCheckbox('canViewReconciliation', perms.canViewReconciliation, isAdmin)}</td>
        <td class="perm-cell" data-label="Tong hop">${permCheckbox('canViewSummary', perms.canViewSummary, isAdmin)}</td>
        <td class="perm-cell" data-label="Voucher da dung">${permCheckbox('canViewUsedVouchers', perms.canViewUsedVouchers, isAdmin)}</td>
        <td data-label="Kich hoat tu"><input type="datetime-local" class="active-from" value="${toLocalInputValue(u.activeFrom)}" /></td>
        <td data-label="Het han"><input type="datetime-local" class="active-until" value="${toLocalInputValue(u.activeUntil)}" /></td>
        <td class="state-cell" data-label="Trang thai">${STATE_CHIP[u.state] || ''}</td>
        <td data-label="Don vi thu hoi">
          <select class="redemption-unit">
            <option value="">-- Chua gan diem tieu --</option>
            ${redemptionUnitOptions()}
          </select>
        </td>
        <td data-label="Nhom quyen xem bao cao">
          <select class="report-access-group">
            <option value="">Mac dinh (chi cong ty cua minh)</option>
            ${groupOptions}
          </select>
        </td>
        <td data-label="Mat khau moi"><input type="password" class="edit-password" placeholder="De trong = giu nguyen" autocomplete="new-password" /></td>
        <td data-label="Hanh dong">
          <div class="actions-cell">
            <button class="btn-secondary save-btn" type="button">Luu</button>
            <button class="btn-secondary lock-btn" type="button"></button>
            <button class="btn-danger delete-btn" type="button"></button>
          </div>
        </td>
      </tr>`;
    })
    .join('');

  usersBody.querySelectorAll('tr[data-user-id]').forEach((tr) => {
    const userId = tr.dataset.userId;
    const user = users.find((u) => String(u.userId) === String(userId));
    if (user && user.reportAccessGroupId) {
      tr.querySelector('.report-access-group').value = String(user.reportAccessGroupId);
    }
    if (user && user.locationsDetail) {
      const matchedUnit = redemptionUnitsCache.find((u) => u.LocationCode === user.locationsDetail);
      if (matchedUnit) tr.querySelector('.redemption-unit').value = String(matchedUnit.Id);
    }

    const lockBtn = tr.querySelector('.lock-btn');
    const isLocked = user && user.state === 'expired';
    lockBtn.textContent = isLocked ? 'Mo khoa' : 'Khoa';
    lockBtn.addEventListener('click', () => toggleLockFields(tr, !isLocked));

    const deleteBtn = tr.querySelector('.delete-btn');
    const deleted = user && user.isDeleted;
    deleteBtn.textContent = deleted ? 'Khoi phuc' : 'Xoa';
    deleteBtn.classList.toggle('btn-danger', !deleted);
    deleteBtn.classList.toggle('btn-secondary', !!deleted);
    deleteBtn.addEventListener('click', () => deleteUser(tr, !deleted));

    tr.querySelector('.save-btn').addEventListener('click', () => saveUser(tr));
  });
}

/** Nut "Khoa"/"Mo khoa" chi DIEN SAN gia tri vao 2 o Kich hoat tu/Het han - PHAI bam "Luu" moi
 * that su co hieu luc, giong het cach cac truong khac trong dong nay hoat dong (xem lai truoc
 * khi luu, khong am tham doi ngay). */
function toggleLockFields(tr, lock) {
  const activeFromInput = tr.querySelector('.active-from');
  const activeUntilInput = tr.querySelector('.active-until');
  activeFromInput.value = '';
  activeUntilInput.value = lock ? toLocalInputValue(new Date().toISOString()) : '';
  const lockBtn = tr.querySelector('.lock-btn');
  lockBtn.textContent = lock ? 'Mo khoa' : 'Khoa';
  showToast(lock ? 'Da dien "Het han" = bay gio - bam Luu de khoa that su' : 'Da xoa gioi han - bam Luu de mo khoa that su');
}

async function deleteUser(tr, isDeleted) {
  const username = tr.dataset.username;
  const confirmMsg = isDeleted
    ? `Xoa tai khoan "${username}"? Tai khoan se khong dang nhap duoc nua va an khoi danh sach - co the khoi phuc lai sau.`
    : `Khoi phuc tai khoan "${username}"?`;
  if (!confirm(confirmMsg)) return;

  const deleteBtn = tr.querySelector('.delete-btn');
  deleteBtn.disabled = true;
  try {
    await apiFetch(`/users/${encodeURIComponent(tr.dataset.userId)}/delete-status`, {
      method: 'PUT',
      body: JSON.stringify({ isDeleted, username }),
    });
    showToast(isDeleted ? `Da xoa tai khoan "${username}"` : `Da khoi phuc tai khoan "${username}"`);
    load();
  } catch (err) {
    showToast(err.message);
    deleteBtn.disabled = false;
  }
}

async function saveUser(tr) {
  const userId = tr.dataset.userId;
  const username = tr.dataset.username;
  const activeFrom = fromLocalInputValue(tr.querySelector('.active-from').value);
  const activeUntil = fromLocalInputValue(tr.querySelector('.active-until').value);
  const groupIdRaw = tr.querySelector('.report-access-group').value;
  const groupId = groupIdRaw ? Number(groupIdRaw) : null;
  const redemptionUnitIdRaw = tr.querySelector('.redemption-unit').value;
  const redemptionUnitId = redemptionUnitIdRaw ? Number(redemptionUnitIdRaw) : null;
  const fullName = tr.querySelector('.edit-fullname').value.trim();
  const passwordInput = tr.querySelector('.edit-password');
  const password = passwordInput.value || null;
  if (!fullName) {
    showToast('Ho ten khong duoc de trong');
    return;
  }
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
    {
      label: 'Don vi thu hoi',
      run: () => apiFetch(`/users/${encodeURIComponent(userId)}/location`, {
        method: 'PUT',
        body: JSON.stringify({ redemptionUnitId, username }),
      }),
    },
    {
      label: 'Ho so (ho ten/mat khau)',
      run: () => apiFetch(`/users/${encodeURIComponent(userId)}/profile`, {
        method: 'PUT',
        body: JSON.stringify({ fullName, password, username }),
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
  const redemptionUnitIdRaw = document.getElementById('newRedemptionUnitId').value;
  const redemptionUnitId = redemptionUnitIdRaw ? Number(redemptionUnitIdRaw) : null;

  createUserBtn.disabled = true;
  try {
    await apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, fullName, role: Number(role), redemptionUnitId }),
    });
    showToast(`Da tao tai khoan "${username}"`);
    document.getElementById('newUsername').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('newFullName').value = '';
    document.getElementById('newCompanyId').value = '';
    refreshNewRedemptionUnitOptions();
    load();
  } catch (err) {
    showToast(err.message);
  } finally {
    createUserBtn.disabled = false;
  }
});

load();
