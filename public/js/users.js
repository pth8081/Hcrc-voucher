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
  'canManageEmailSchedules',
];
const showDeletedCheckbox = document.getElementById('showDeletedCheckbox');
const userSearchInput = document.getElementById('userSearchInput');
const filterCompanyInput = document.getElementById('filterCompany');
const filterRedemptionUnitInput = document.getElementById('filterRedemptionUnit');

/** Loc danh sach tai khoan NGAY TRONG TRINH DUYET (du lieu da tai het ve), khong goi lai API -
 * danh sach tai khoan thuong khong qua lon nen loc phia client la du nhanh, don gian hon han
 * phai them tham so tim kiem o backend. So khop khong phan biet hoa/thuong tren ca ten dang
 * nhap (tr.dataset.username) va ho ten (doc truc tiep tu o input, vi ho ten la 1 o co the sua
 * duoc, khong phai van ban tinh).
 *
 * v3.81 (diem 5/6): ket hop THEM 2 bo loc Cong ty/Diem thu hoi (AND voi o tim kiem, khong doi
 * nhau) - doc tu `tr.dataset.companyId`/`tr.dataset.unitId` da gan san luc renderUsers() (xem
 * findUnitForUser()). Chon Cong ty nhung KHONG chon rieng 1 Diem thu hoi cu the = hien TOAN BO
 * tai khoan cua cong ty do (moi diem thu hoi), dung yeu cau nguoi dung.
 */
function applyUserSearchFilter() {
  const term = userSearchInput.value.trim().toLowerCase();
  const companyFilter = filterCompanyInput.value;
  const unitFilter = filterRedemptionUnitInput.value;
  document.querySelectorAll('#usersBody tr[data-user-id]').forEach((tr) => {
    const username = (tr.dataset.username || '').toLowerCase();
    const fullNameInput = tr.querySelector('.edit-fullname');
    const fullName = fullNameInput ? fullNameInput.value.toLowerCase() : '';
    const matchTerm = !term || username.includes(term) || fullName.includes(term);
    const matchCompany = !companyFilter || tr.dataset.companyId === companyFilter;
    const matchUnit = !unitFilter || tr.dataset.unitId === unitFilter;
    tr.classList.toggle('row-filtered-out', !(matchTerm && matchCompany && matchUnit));
  });
}
userSearchInput.addEventListener('input', applyUserSearchFilter);

/** O chon "Cong ty" cho bo loc (khac voi o chon "Cong ty" luc tao tai khoan moi, xem
 * renderNewCompanyOptions()) - doi Cong ty se nap lai o "Diem thu hoi" chi gom dung diem thu hoi
 * cua cong ty do (giong het cach lam cua refreshNewRedemptionUnitOptions), roi loc lai ngay. */
function renderFilterCompanyOptions() {
  const current = filterCompanyInput.value;
  filterCompanyInput.innerHTML =
    '<option value="">Tất cả công ty</option>' +
    companiesCache.map((c) => `<option value="${c.Id}">${escapeHtmlLayout(c.CompanyName)}</option>`).join('');
  filterCompanyInput.value = current;
}

function refreshFilterUnitOptions() {
  const companyId = filterCompanyInput.value;
  const current = filterRedemptionUnitInput.value;
  const list = companyId ? redemptionUnitsCache.filter((u) => String(u.CompanyId) === String(companyId)) : redemptionUnitsCache;
  filterRedemptionUnitInput.innerHTML =
    '<option value="">Tất cả điểm thu hồi</option>' + list.map((u) => `<option value="${u.Id}">${unitLabel(u)}</option>`).join('');
  if (list.some((u) => String(u.Id) === current)) filterRedemptionUnitInput.value = current;
}
filterCompanyInput.addEventListener('change', () => {
  refreshFilterUnitOptions();
  applyUserSearchFilter();
});
filterRedemptionUnitInput.addEventListener('change', applyUserSearchFilter);

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
    renderFilterCompanyOptions();
    refreshFilterUnitOptions();
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
    companiesCache.map((c) => `<option value="${c.Id}">${escapeHtmlLayout(c.CompanyName)}${c.CompanyType === 'PARTNER' ? ' (Công ty đối tác)' : ''}</option>`).join('');
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

/** "canManageUnits" -> "adminCanManageUnits" / "canManageAccounts" -> "partnerAdminCanManageAccounts" -
 * cac checkbox dung ten TRUNG VOI body server mong doi (vd PUT /users/:id/admin-features nhan
 * thang `canManageUnits`), nhung doc trang thai BAN DAU tu `u.permissions` (permissionService.js)
 * lai dung ten DAY DU co tien to ("adminCanManageUnits"/"partnerAdminCanManageAccounts") - ham
 * nay chuyen doi 1 chieu de hien checked dung ngay tu dau, tranh go trung 2 lan ten quyen. */
function prefixedPermKey(prefix, key) {
  return prefix + key[0].toUpperCase() + key.slice(1);
}

/** 4 quyen con cua man hinh "Quan tri doi tac" (tung tab) - xem permissionService.js. */
const PARTNER_ADMIN_TAB_FIELDS = [
  { key: 'canManageAccounts', label: 'Quản lý tài khoản' },
  { key: 'canManageOrg', label: 'Công ty & Điểm tiêu' },
  { key: 'canViewAuditLog', label: 'Nhật ký quản trị' },
  { key: 'canViewScanLog', label: 'Hoạt động quét/thu hồi' },
];

/** 5 quyen man hinh "Quan tri" (tung man con) - xem permissionService.js. */
const ADMIN_FEATURE_FIELDS = [
  { key: 'canManageUnits', label: 'Đơn vị thu hồi' },
  { key: 'canManageConnections', label: 'Kết nối API' },
  { key: 'canManageUsers', label: 'Tài khoản' },
  { key: 'canViewAdminLog', label: 'Nhật ký hệ thống' },
  { key: 'canManageEmailSettings', label: 'Thiết lập email' },
];

function renderUsers(users) {
  const groupOptions = accessGroupsCache
    .map((g) => `<option value="${g.Id}">${escapeHtmlLayout(g.GroupName)}</option>`)
    .join('');
  const currentUserId = (getUser() || {}).userId;

  usersBody.innerHTML = users
    .map((u) => {
      const isAdmin = Number(u.role) === 1;
      const perms = u.permissions || {};
      const deleted = !!u.isDeleted;
      const unit = findUnitForUser(u);
      // v3.94 (xem sql/043): uu tien Cong ty gan TRUC TIEP (perms.companyId) - BAT BUOC voi "Tai
      // khoan doi tac" (khong co Diem tieu nen findUnitForUser() luon tra ve null cho ho), van
      // dung duoc voi tai khoan thuong neu ca 2 nguon KHOP (admin da luu dung Cong ty qua o chon
      // moi o duoi, xem renderUsers()).
      const companyIdForFilter = perms.companyId || (unit ? unit.CompanyId : '');
      return `
      <tr data-user-id="${u.userId}" data-username="${escapeHtmlLayout(u.username)}" data-company-id="${companyIdForFilter}" data-unit-id="${unit ? unit.Id : ''}" class="${deleted ? 'row-deleted' : ''}">
        <td data-label="Tên đăng nhập">${escapeHtmlLayout(u.username)}${deleted ? ' <span class="status-badge status-used">ĐÃ XÓA</span>' : ''}</td>
        <td data-label="Họ tên"><input class="edit-fullname" value="${escapeHtmlLayout(u.fullName || '')}" /></td>
        <td data-label="Vai trò">${isAdmin ? 'Quản trị' : 'Nhân viên'}</td>
        <td class="perm-cell" data-label="Thu hồi">${permCheckbox('canRedeemVoucher', perms.canRedeemVoucher, isAdmin)}</td>
        <td class="perm-cell" data-label="Đối soát">${permCheckbox('canViewReconciliation', perms.canViewReconciliation, isAdmin)}</td>
        <td class="perm-cell" data-label="Tổng hợp">${permCheckbox('canViewSummary', perms.canViewSummary, isAdmin)}</td>
        <td class="perm-cell" data-label="Voucher đã dùng">${permCheckbox('canViewUsedVouchers', perms.canViewUsedVouchers, isAdmin)}</td>
        <td class="perm-cell" data-label="HD nghiệp vụ">${permCheckbox('canViewBusinessGuide', perms.canViewBusinessGuide, isAdmin)}</td>
        <td class="perm-cell" data-label="HD hệ thống">${permCheckbox('canViewSystemGuide', perms.canViewSystemGuide, isAdmin)}</td>
        <td class="perm-cell" data-label="Lịch gửi email">${permCheckbox('canManageEmailSchedules', perms.canManageEmailSchedules, isAdmin)}</td>
        <td data-label="Kích hoạt từ"><input type="datetime-local" class="active-from" value="${toLocalInputValue(u.activeFrom)}" /></td>
        <td data-label="Hết hạn"><input type="datetime-local" class="active-until" value="${toLocalInputValue(u.activeUntil)}" /></td>
        <td class="state-cell" data-label="Trạng thái">${STATE_CHIP[u.state] || ''}</td>
        <td data-label="Công ty / Tài khoản đối tác">
          <select class="edit-company-id" ${isAdmin ? 'disabled' : ''}>
            <option value="">-- Chưa gán công ty --</option>
            ${companiesCache.map((c) => `<option value="${c.Id}" ${perms.companyId === c.Id ? 'selected' : ''}>${escapeHtmlLayout(c.CompanyName)}${c.CompanyType === 'PARTNER' ? ' (Công ty đối tác)' : ''}</option>`).join('')}
          </select>
          ${!isAdmin ? `
          <label class="perm-item fs-13 mt-6">
            <input type="checkbox" class="checkbox-input edit-is-partner-account" ${perms.isPartnerAccount ? 'checked' : ''} /> Tài khoản đối tác
          </label>
          <p class="hint" style="margin:4px 0 0;">Chỉ bật được khi Công ty ở trên đã là "Công ty đối tác" - tài khoản sẽ mất chức năng thu hồi và không gán được Đơn vị thu hồi.</p>` : ''}
        </td>
        <td data-label="Đơn vị thu hồi">
          <select class="redemption-unit" ${!isAdmin && perms.isPartnerAccount ? 'disabled' : ''}>
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
          ${!isAdmin ? `
          <div class="perm-grid mt-6">
            ${PARTNER_ADMIN_TAB_FIELDS.map(
              (f) => `
              <label class="perm-item fs-13"><input type="checkbox" class="checkbox-input partner-admin-tab-perm" data-perm="${f.key}" ${perms[prefixedPermKey('partnerAdmin', f.key)] !== false ? 'checked' : ''} /> ${f.label}</label>`
            ).join('')}
          </div>
          <p class="hint" style="margin:4px 0 0;">Chỉ áp dụng khi tài khoản này được chọn 1 hệ thống ở trên - bỏ tick tab nào thì tab đó ẩn khỏi menu "Quản trị đối tác" của họ.</p>` : ''}
        </td>
        <td data-label="Quyền quản trị hệ thống">
          ${isAdmin ? (
            u.userId === currentUserId
              ? '<p class="hint m-0">Không tự sửa được quyền của chính mình - nhờ 1 Quản trị khác sửa hộ.</p>'
              : `<div class="perm-grid">
                  ${ADMIN_FEATURE_FIELDS.map(
                    (f) => `
                    <label class="perm-item fs-13"><input type="checkbox" class="checkbox-input admin-feature-perm" data-perm="${f.key}" ${perms[prefixedPermKey('admin', f.key)] !== false ? 'checked' : ''} /> ${f.label}</label>`
                  ).join('')}
                </div>`
          ) : '<span class="text-muted">-</span>'}
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

    // "Tai khoan doi tac" bat -> khong con gan Diem tieu duoc nua (server cung tu go, xem
    // user.controller.js#updateCompany) - khoa luon o chon "Don vi thu hoi" tren giao dien cho
    // khop, tranh gui 2 gia tri mau thuan nhau cung luc khi bam "Luu".
    const isPartnerAccountCheckbox = tr.querySelector('.edit-is-partner-account');
    if (isPartnerAccountCheckbox) {
      isPartnerAccountCheckbox.addEventListener('change', () => {
        const unitSelect = tr.querySelector('.redemption-unit');
        unitSelect.disabled = isPartnerAccountCheckbox.checked;
        if (isPartnerAccountCheckbox.checked) unitSelect.value = '';
      });
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
  const companyIdRaw = tr.querySelector('.edit-company-id') ? tr.querySelector('.edit-company-id').value : '';
  const companyId = companyIdRaw ? Number(companyIdRaw) : null;
  const isPartnerAccountCheckbox = tr.querySelector('.edit-is-partner-account');
  const isPartnerAccount = !!(isPartnerAccountCheckbox && isPartnerAccountCheckbox.checked);
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
  const partnerAdminTabPerms = {};
  tr.querySelectorAll('.partner-admin-tab-perm').forEach((el) => {
    partnerAdminTabPerms[el.dataset.perm] = el.checked;
  });
  const adminFeaturePermEls = tr.querySelectorAll('.admin-feature-perm');
  const adminFeaturePerms = {};
  adminFeaturePermEls.forEach((el) => {
    adminFeaturePerms[el.dataset.perm] = el.checked;
  });

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
      label: 'Công ty / Tài khoản đối tác',
      run: () => apiFetch(`/users/${encodeURIComponent(userId)}/company`, {
        method: 'PUT',
        body: JSON.stringify({ companyId, isPartnerAccount, username }),
      }),
    },
    // "Tai khoan doi tac" -> server tu go Dia diem (xem user.controller.js#updateCompany) - BO
    // QUA job nay de tranh goi dong thoi 2 request doi Locations_Detail (co the tranh chap, ai
    // chay sau cung thang) voi job "Cong ty / Tai khoan doi tac" o tren.
    ...(isPartnerAccount
      ? []
      : [
          {
            label: 'Đơn vị thu hồi',
            run: () => apiFetch(`/users/${encodeURIComponent(userId)}/location`, {
              method: 'PUT',
              body: JSON.stringify({ redemptionUnitId, username }),
            }),
          },
        ]),
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
        body: JSON.stringify({ connectionId: partnerAdminConnectionId, ...partnerAdminTabPerms, username }),
      }),
    },
  ];
  // Chi gui job nay khi dong co render ra 5 checkbox (tai khoan Quan tri VA khong phai chinh
  // minh dang dang nhap - xem renderUsers()) - tranh goi API thua (va API cung se tu choi 400
  // neu co gang goi cho chinh minh).
  if (adminFeaturePermEls.length) {
    jobs.push({
      label: 'Quyền quản trị hệ thống',
      run: () => apiFetch(`/users/${encodeURIComponent(userId)}/admin-features`, {
        method: 'PUT',
        body: JSON.stringify({ ...adminFeaturePerms, username }),
      }),
    });
  }

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
  const newCompanyIdRaw = document.getElementById('newCompanyId').value;
  const companyId = newCompanyIdRaw ? Number(newCompanyIdRaw) : null;

  createUserBtn.disabled = true;
  try {
    await apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, fullName, role: Number(role), redemptionUnitId, companyId }),
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
