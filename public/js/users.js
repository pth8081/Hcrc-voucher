requireAuth();
renderTopbar('users');

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tabCreate').classList.toggle('hidden', btn.dataset.tab !== 'create');
    document.getElementById('tabManage').classList.toggle('hidden', btn.dataset.tab !== 'manage');
    document.getElementById('tabSystemsReport').classList.toggle('hidden', btn.dataset.tab !== 'systemsReport');
  });
});

const notAdminNotice = document.getElementById('notAdminNotice');
const usersCard = document.getElementById('usersCard');
const usersBody = document.getElementById('usersBody');

const STATE_CHIP = {
  active: '<span class="status-badge status-unused">ĐANG HOẠT ĐỘNG</span>',
  not_yet_active: '<span class="status-badge status-other">CHƯA KÍCH HOẠT</span>',
  expired: '<span class="status-badge status-used">ĐÃ HẾT HẠN</span>',
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
let voucherConnectionsCache = [];
let usersCache = [];

const PERM_FIELDS = [
  'canRedeemVoucher',
  'canViewReconciliation',
  'canViewSummary',
  'canViewUsedVouchers',
  'canViewBusinessGuide',
  'canViewSystemGuide',
];
const showDeletedCheckbox = document.getElementById('showDeletedCheckbox');
const userSearchInput = document.getElementById('userSearchInput');

/** Loc danh sach tai khoan NGAY TRONG TRINH DUYET (du lieu da tai het ve), khong goi lai API -
 * danh sach tai khoan thuong khong qua lon nen loc phia client la du nhanh, don gian hon han
 * phai them tham so tim kiem o backend. So khop khong phan biet hoa/thuong tren ca ten dang
 * nhap (tr.dataset.username) va ho ten (doc truc tiep tu o input, vi ho ten la 1 o co the sua
 * duoc, khong phai van ban tinh). */
function applyUserSearchFilter() {
  const term = userSearchInput.value.trim().toLowerCase();
  document.querySelectorAll('#usersBody tr[data-user-id]').forEach((tr) => {
    if (!term) {
      tr.classList.remove('row-filtered-out');
      return;
    }
    const username = (tr.dataset.username || '').toLowerCase();
    const fullNameInput = tr.querySelector('.edit-fullname');
    const fullName = fullNameInput ? fullNameInput.value.toLowerCase() : '';
    const match = username.includes(term) || fullName.includes(term);
    tr.classList.toggle('row-filtered-out', !match);
  });
}
userSearchInput.addEventListener('input', applyUserSearchFilter);

async function load() {
  try {
    const includeDeleted = showDeletedCheckbox.checked ? 'true' : 'false';
    const [users, groups, companies, units, connections] = await Promise.all([
      apiFetch(`/users?includeDeleted=${includeDeleted}`),
      apiFetch('/access-groups').catch(() => []),
      apiFetch('/companies').catch(() => []),
      apiFetch('/redemption-units').catch(() => []),
      apiFetch('/api-connections').catch(() => []),
    ]);
    accessGroupsCache = groups;
    companiesCache = companies;
    redemptionUnitsCache = units;
    voucherConnectionsCache = connections;
    usersCache = users;
    renderNewCompanyOptions();
    renderUsers(users);
    applyUserSearchFilter();
    renderReportFilterOptions();
    renderSystemsReport();
  } catch (err) {
    notAdminNotice.classList.remove('hidden');
    usersCard.classList.add('hidden');
  }
}
showDeletedCheckbox.addEventListener('change', load);

/** Tim Don vi thu hoi (va qua do, Cong ty) ma 1 tai khoan dang gan, dua vao LocationCode -
 * dung chung logic voi o chon "Don vi thu hoi" trong tab "Danh sach & phan quyen" (xem
 * renderUsers() o tren) de bao cao luon khop voi du lieu dang sua. */
function findUnitForUser(user) {
  if (!user.locationsDetail) return null;
  return redemptionUnitsCache.find((u) => u.LocationCode === user.locationsDetail) || null;
}

// M15: id 0 la "he thong ao" dai dien cho du lieu CU (giao dich chua tung duoc gan he thong
// nao, truoc khi app tich hop nhieu he thong voucher) - dung CUNG co che tick chon/luu voi cac
// he thong that (xem userVoucherSystemService.js#UNTAGGED_CONNECTION_ID, cung 1 chuoi hien thi).
// Khong tick gi (ke ca "Khac") van giu nguyen y nghia cu: khong gioi han, xem/dung duoc TAT CA
// (bao gom ca du lieu cu) - chi khi tick RIENG 1 vai he thong THAT (khong tick "Khac") thi du
// lieu cu moi bi an di trong bao cao.
function voucherSystemCheckboxOptions() {
  return [...voucherConnectionsCache, { id: 0, name: 'Khác (dữ liệu cũ, chưa qua hệ thống nào)' }];
}

function renderReportFilterOptions() {
  const companySelect = document.getElementById('reportFilterCompany');
  const currentCompany = companySelect.value;
  companySelect.innerHTML =
    '<option value="">Tất cả công ty</option>' +
    companiesCache.map((c) => `<option value="${c.Id}">${escapeHtmlLayout(c.CompanyName)}</option>`).join('');
  companySelect.value = currentCompany;

  const systemSelect = document.getElementById('reportFilterSystem');
  const currentSystem = systemSelect.value;
  systemSelect.innerHTML =
    '<option value="">Tất cả hệ thống</option>' +
    voucherConnectionsCache.map((c) => `<option value="${c.id}">${escapeHtmlLayout(c.name)}</option>`).join('');
  systemSelect.value = currentSystem;
}
document.getElementById('reportFilterCompany').addEventListener('change', renderSystemsReport);
document.getElementById('reportFilterSystem').addEventListener('change', renderSystemsReport);

/** Bang tong hop CHI XEM (tab "Bao cao phan quyen he thong") - loc hoan toan phia trinh duyet
 * tren du lieu da tai (giong applyUserSearchFilter), khong goi API rieng. Tai khoan "khong
 * gioi han" (voucherSystems rong) duoc tinh la dang duoc dung/xem MOI he thong hien co, nen
 * van khop khi loc theo 1 he thong cu the - dung quy uoc da dung trong userVoucherSystemService.js. */
function renderSystemsReport() {
  const body = document.getElementById('systemsReportBody');
  const companyFilter = document.getElementById('reportFilterCompany').value;
  const systemFilter = document.getElementById('reportFilterSystem').value ? Number(document.getElementById('reportFilterSystem').value) : null;

  const rows = usersCache
    .filter((u) => !u.isDeleted)
    .map((u) => {
      const unit = findUnitForUser(u);
      return { user: u, unit };
    })
    .filter(({ unit }) => !companyFilter || (unit && String(unit.CompanyId) === String(companyFilter)))
    .filter(({ user }) => {
      if (!systemFilter) return true;
      if (!user.voucherSystems || !user.voucherSystems.length) return true; // khong gioi han = co quyen voi moi he thong
      return user.voucherSystems.some((s) => s.connectionId === systemFilter);
    });

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6" class="text-muted">Không có tài khoản nào khớp với bộ lọc</td></tr>';
    return;
  }

  body.innerHTML = rows
    .map(({ user: u, unit }) => {
      const isAdmin = Number(u.role) === 1;
      const systemsBadge = (u.voucherSystems || []).length
        ? u.voucherSystems.map((s) => `<span class="status-badge status-other">${escapeHtmlLayout(s.connectionName)}</span>`).join(' ')
        : '<span class="status-badge status-unused">Không giới hạn (toàn bộ hệ thống)</span>';
      return `
      <tr>
        <td data-label="Tài khoản">${escapeHtmlLayout(u.username)}</td>
        <td data-label="Họ tên">${escapeHtmlLayout(u.fullName || '')}</td>
        <td data-label="Vai trò">${isAdmin ? 'Quản trị' : 'Nhân viên'}</td>
        <td data-label="Công ty">${unit && unit.CompanyName ? escapeHtmlLayout(unit.CompanyName) : '<span class="text-muted">Chưa gán</span>'}</td>
        <td data-label="Đơn vị thu hồi">${unit ? escapeHtmlLayout(unit.PartnerName) : '<span class="text-muted">Chưa gán</span>'}</td>
        <td data-label="Hệ thống voucher được dùng">${systemsBadge}</td>
      </tr>`;
    })
    .join('');
}

/** Nhan dien nhanh: "CompanyName - PartnerName (LocationCode)" - du de phan biet cac diem tieu
 * trung ten o cong ty khac nhau, ma van gon trong 1 dropdown. */
function unitLabel(u) {
  const company = u.CompanyName ? escapeHtmlLayout(u.CompanyName) : 'Chưa gán công ty';
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
    '<option value="">-- Chưa gán công ty --</option>' +
    companiesCache.map((c) => `<option value="${c.Id}">${escapeHtmlLayout(c.CompanyName)}</option>`).join('');
}

function refreshNewRedemptionUnitOptions() {
  const companyId = document.getElementById('newCompanyId').value;
  const select = document.getElementById('newRedemptionUnitId');
  if (!companyId) {
    select.innerHTML = '<option value="">-- Chọn công ty trước --</option>';
    return;
  }
  const opts = redemptionUnitOptions(companyId);
  select.innerHTML = opts
    ? `<option value="">-- Không gán điểm tiêu --</option>${opts}`
    : '<option value="">-- Công ty này chưa có điểm tiêu nào --</option>';
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
        <td data-label="Tên đăng nhập">${escapeHtmlLayout(u.username)}${deleted ? ' <span class="status-badge status-used">ĐÃ XÓA</span>' : ''}</td>
        <td data-label="Họ tên"><input class="edit-fullname" value="${escapeHtmlLayout(u.fullName || '')}" /></td>
        <td data-label="Vai trò">${isAdmin ? 'Quản trị' : 'Nhân viên'}</td>
        <td class="perm-cell" data-label="Thu hồi">${permCheckbox('canRedeemVoucher', perms.canRedeemVoucher, isAdmin)}</td>
        <td class="perm-cell" data-label="Đối soát">${permCheckbox('canViewReconciliation', perms.canViewReconciliation, isAdmin)}</td>
        <td class="perm-cell" data-label="Tổng hợp">${permCheckbox('canViewSummary', perms.canViewSummary, isAdmin)}</td>
        <td class="perm-cell" data-label="Voucher đã dùng">${permCheckbox('canViewUsedVouchers', perms.canViewUsedVouchers, isAdmin)}</td>
        <td class="perm-cell" data-label="HD nghiệp vụ">${permCheckbox('canViewBusinessGuide', perms.canViewBusinessGuide, isAdmin)}</td>
        <td class="perm-cell" data-label="HD hệ thống">${permCheckbox('canViewSystemGuide', perms.canViewSystemGuide, isAdmin)}</td>
        <td data-label="Kích hoạt từ"><input type="datetime-local" class="active-from" value="${toLocalInputValue(u.activeFrom)}" /></td>
        <td data-label="Hết hạn"><input type="datetime-local" class="active-until" value="${toLocalInputValue(u.activeUntil)}" /></td>
        <td class="state-cell" data-label="Trạng thái">${STATE_CHIP[u.state] || ''}</td>
        <td data-label="Đơn vị thu hồi">
          <select class="redemption-unit">
            <option value="">-- Chưa gán điểm tiêu --</option>
            ${redemptionUnitOptions()}
          </select>
        </td>
        <td data-label="Nhóm quyền xem báo cáo">
          <select class="report-access-group">
            <option value="">Mặc định (chỉ công ty của mình)</option>
            ${groupOptions}
          </select>
        </td>
        <td data-label="Hệ thống voucher được dùng">
          <div class="voucher-system-checkboxes">
            ${voucherSystemCheckboxOptions()
              .map(
                (c) => `
              <label class="checkbox-inline">
                <input type="checkbox" class="voucher-system-checkbox" data-id="${c.id}" ${
                  (u.voucherSystems || []).some((s) => s.connectionId === c.id) ? 'checked' : ''
                } />
                ${escapeHtmlLayout(c.name)}
              </label>`
              )
              .join('')}
          </div>
        </td>
        <td data-label="Quản trị đối tác">
          <select class="partner-admin-connection" ${isAdmin ? 'disabled' : ''}>
            <option value="">-- Không --</option>
            ${voucherConnectionsCache.map((c) => `<option value="${c.id}">${escapeHtmlLayout(c.name)}</option>`).join('')}
          </select>
        </td>
        <td data-label="Mật khẩu mới"><input type="password" class="edit-password" placeholder="Để trống = giữ nguyên" autocomplete="new-password" /></td>
        <td data-label="Hành động">
          <div class="actions-cell">
            <button class="btn-secondary edit-toggle-btn" type="button">Sửa</button>
            <button class="btn-secondary save-btn" type="button">Lưu</button>
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
    if (user && user.permissions && user.permissions.partnerAdminConnectionId) {
      tr.querySelector('.partner-admin-connection').value = String(user.permissions.partnerAdminConnectionId);
    }

    const lockBtn = tr.querySelector('.lock-btn');
    const isLocked = user && user.state === 'expired';
    lockBtn.textContent = isLocked ? 'Mở khóa' : 'Khóa';
    lockBtn.addEventListener('click', () => toggleLockFields(tr, !isLocked));

    const deleteBtn = tr.querySelector('.delete-btn');
    const deleted = user && user.isDeleted;
    deleteBtn.textContent = deleted ? 'Khôi phục' : 'Xóa';
    deleteBtn.classList.toggle('btn-danger', !deleted);
    deleteBtn.classList.toggle('btn-secondary', !!deleted);
    deleteBtn.addEventListener('click', () => deleteUser(tr, !deleted));

    tr.querySelector('.save-btn').addEventListener('click', () => saveUser(tr));

    const editToggleBtn = tr.querySelector('.edit-toggle-btn');
    editToggleBtn.addEventListener('click', () => toggleRowExpanded(tr));
  });
}

/** Tren dien thoai (man hinh hep), moi dong tai khoan mac dinh THU GON - chi hien Ten dang
 * nhap/Ho ten/Vai tro/Trang thai/Hanh dong (xem CSS @media trong users.css) - bam "Sua" de mo
 * ra day du cac truong chi tiet (quyen, lich hieu luc, don vi thu hoi, nhom bao cao, mat khau).
 * Tren man hinh rong (desktop), CSS giu nguyen bang hien thi day du nhu truoc - nut nay an di,
 * khong doi hanh vi cu. */
function toggleRowExpanded(tr) {
  const expanded = tr.classList.toggle('row-expanded');
  tr.querySelector('.edit-toggle-btn').textContent = expanded ? 'Đóng' : 'Sửa';
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
  lockBtn.textContent = lock ? 'Mở khóa' : 'Khóa';
  showToast(lock ? 'Đã điền "Hết hạn" = bây giờ - bấm Lưu để khóa thật sự' : 'Đã xóa giới hạn - bấm Lưu để mở khóa thật sự');
}

async function deleteUser(tr, isDeleted) {
  const username = tr.dataset.username;
  const confirmMsg = isDeleted
    ? `Xóa tài khoản "${username}"? Tài khoản sẽ không đăng nhập được nữa và ẩn khỏi danh sách - có thể khôi phục lại sau.`
    : `Khôi phục tài khoản "${username}"?`;
  if (!confirm(confirmMsg)) return;

  const deleteBtn = tr.querySelector('.delete-btn');
  deleteBtn.disabled = true;
  try {
    await apiFetch(`/users/${encodeURIComponent(tr.dataset.userId)}/delete-status`, {
      method: 'PUT',
      body: JSON.stringify({ isDeleted, username }),
    });
    showToast(isDeleted ? `Đã xóa tài khoản "${username}"` : `Đã khôi phục tài khoản "${username}"`);
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
    showToast('Họ tên không được để trống');
    return;
  }
  const permissions = {};
  PERM_FIELDS.forEach((field) => {
    const el = tr.querySelector(`.perm-${field}`);
    permissions[field] = !!(el && el.checked);
  });
  const connectionIds = Array.from(tr.querySelectorAll('.voucher-system-checkbox:checked')).map((el) => Number(el.dataset.id));
  const partnerAdminConnectionRaw = tr.querySelector('.partner-admin-connection').value;
  const partnerAdminConnectionId = partnerAdminConnectionRaw ? Number(partnerAdminConnectionRaw) : null;

  const saveBtn = tr.querySelector('.save-btn');
  saveBtn.disabled = true;

  const jobs = [
    {
      label: 'Lịch hiệu lực',
      run: () => apiFetch(`/users/${encodeURIComponent(userId)}/schedule`, {
        method: 'PUT',
        body: JSON.stringify({ activeFrom, activeUntil, username }),
      }),
    },
    {
      label: 'Nhóm quyền báo cáo',
      run: () => apiFetch(`/users/${encodeURIComponent(userId)}/report-access`, {
        method: 'PUT',
        body: JSON.stringify({ groupId, username }),
      }),
    },
    {
      label: 'Quyền tính năng',
      run: () => apiFetch(`/users/${encodeURIComponent(userId)}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ ...permissions, username }),
      }),
    },
    {
      label: 'Đơn vị thu hồi',
      run: () => apiFetch(`/users/${encodeURIComponent(userId)}/location`, {
        method: 'PUT',
        body: JSON.stringify({ redemptionUnitId, username }),
      }),
    },
    {
      label: 'Hệ thống voucher được dùng',
      run: () => apiFetch(`/users/${encodeURIComponent(userId)}/voucher-systems`, {
        method: 'PUT',
        body: JSON.stringify({ connectionIds, username }),
      }),
    },
    {
      label: 'Hồ sơ (họ tên/mật khẩu)',
      run: () => apiFetch(`/users/${encodeURIComponent(userId)}/profile`, {
        method: 'PUT',
        body: JSON.stringify({ fullName, password, username }),
      }),
    },
    {
      label: 'Quản trị đối tác',
      run: () => apiFetch(`/users/${encodeURIComponent(userId)}/partner-admin`, {
        method: 'PUT',
        body: JSON.stringify({ connectionId: partnerAdminConnectionId, username }),
      }),
    },
  ];

  try {
    const results = await Promise.allSettled(jobs.map((j) => j.run()));
    const failed = results
      .map((r, i) => ({ r, label: jobs[i].label }))
      .filter((x) => x.r.status === 'rejected');

    if (!failed.length) {
      showToast('Đã lưu tài khoản');
    } else if (failed.length === jobs.length) {
      showToast(`Lưu thất bại toàn bộ: ${failed[0].r.reason.message}`);
    } else {
      const names = failed.map((x) => x.label).join(', ');
      showToast(`Lỗi khi lưu: ${names} (${failed[0].r.reason.message}). Các mục còn lại đã lưu.`);
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
    showToast(`Đã tạo tài khoản "${username}"`);
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
