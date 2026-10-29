requireAuth();
renderTopbar('partner-admin');

const notAllowedNotice = document.getElementById('notAllowedNotice');
const partnerAdminCard = document.getElementById('partnerAdminCard');
const partnerAdminTitle = document.getElementById('partnerAdminTitle');
const accList = document.getElementById('accList');
const createForm = document.getElementById('createForm');
const createBtn = document.getElementById('createBtn');
const newUserCompany = document.getElementById('newUserCompany');
const newUserUnit = document.getElementById('newUserUnit');

const orgList = document.getElementById('orgList');
const orgSearchInput = document.getElementById('orgSearchInput');
const newLocationCompany = document.getElementById('newLocationCompany');
const createCompanyBtn = document.getElementById('createCompanyBtn');
const createUnitBtn = document.getElementById('createUnitBtn');
const cancelCompanyEditBtn = document.getElementById('cancelCompanyEditBtn');
const cancelUnitEditBtn = document.getElementById('cancelUnitEditBtn');
const companyFormTitle = document.getElementById('companyFormTitle');
const unitFormTitle = document.getElementById('unitFormTitle');

const STATE_CHIP = {
  active: '<span class="status-badge status-unused">ĐANG HOẠT ĐỘNG</span>',
  not_yet_active: '<span class="status-badge status-other">CHƯA KÍCH HOẠT</span>',
  expired: '<span class="status-badge status-used">ĐÃ HẾT HẠN</span>',
};

// L5 (dung chung cach lam voi admin-log.js): chi can nhan tieng Viet cho cac ma hanh dong THUC
// SU co the lien quan pham vi "Quan tri doi tac" (chinh ho thao tac, hoac HCRC thao tac tren
// tai khoan nhan vien cua ho) - khong can day du nhu admin-log.js vi cac hanh dong ngoai pham vi
// (vd sua Ket noi API, tao Cong ty...) se khong bao gio xuat hien o day.
const ACTION_LABEL = {
  CREATE_USER: 'Tạo tài khoản',
  UPDATE_USER_LOCATION: 'Đổi điểm tiêu tài khoản',
  UPDATE_USER_PROFILE: 'Sửa họ tên/đặt lại mật khẩu',
  DELETE_USER: 'Xóa tài khoản',
  RESTORE_USER: 'Khôi phục tài khoản',
  UPDATE_PERMISSIONS: 'Đổi quyền tính năng',
  UPDATE_SCHEDULE: 'Đổi lịch hiệu lực',
  UPDATE_REPORT_ACCESS: 'Đổi nhóm quyền báo cáo',
  RESET_2FA: 'Gỡ xác thực hai yếu tố',
  UPDATE_USER_VOUCHER_SYSTEMS: 'Đổi hệ thống voucher được dùng',
  UPDATE_PARTNER_ADMIN: 'Đổi quyền quản trị đối tác',
  PARTNER_ADMIN_CREATE_USER: 'Bạn tạo tài khoản mới',
  PARTNER_ADMIN_LOCK_USER: 'Bạn khóa tài khoản',
  PARTNER_ADMIN_UNLOCK_USER: 'Bạn mở khóa tài khoản',
  PARTNER_ADMIN_REMOVE_OWN_CONNECTION: 'Bạn gỡ hệ thống của mình khỏi tài khoản dùng chung',
  PARTNER_ADMIN_UPDATE_PROFILE: 'Bạn sửa họ tên/đặt lại mật khẩu',
  PARTNER_ADMIN_UPDATE_PERMISSIONS: 'Bạn đổi quyền tính năng',
  PARTNER_ADMIN_UPDATE_LOCATION: 'Bạn đổi điểm tiêu tài khoản',
  PARTNER_ADMIN_UPDATE_REPORT_ACCESS_GROUP: 'Bạn đổi nhóm quyền xem báo cáo tài khoản',
  PARTNER_ADMIN_CREATE_COMPANY: 'Bạn tạo công ty',
  PARTNER_ADMIN_UPDATE_COMPANY: 'Bạn sửa công ty',
  PARTNER_ADMIN_DELETE_COMPANY: 'Bạn xóa công ty',
  PARTNER_ADMIN_CREATE_UNIT: 'Bạn tạo điểm tiêu',
  PARTNER_ADMIN_UPDATE_UNIT: 'Bạn sửa điểm tiêu',
  PARTNER_ADMIN_DELETE_UNIT: 'Bạn xóa điểm tiêu',
  PARTNER_ADMIN_CREATE_ACCESS_GROUP: 'Bạn tạo nhóm quyền xem báo cáo',
  PARTNER_ADMIN_UPDATE_ACCESS_GROUP: 'Bạn sửa nhóm quyền xem báo cáo',
  PARTNER_ADMIN_DELETE_ACCESS_GROUP: 'Bạn xóa nhóm quyền xem báo cáo',
};

// M20 (v3.81): 4 tab cua man nay gio gan voi 4 quyen con rieng (xem permissionService.js) - tab
// nao KHONG duoc HCRC cap se AN HAN khoi menu (khong chi khoa API) - doc truc tiep tu
// user.permissions (da "chup" san luc dang nhap, xem authService.js#issueSession). Gia tri
// !== false (thay vi === true) de tuong thich nguoc voi phien dang nhap TU TRUOC khi co tinh
// nang nay (permissions con thieu truong, coi nhu "chua ro" -> van hien, giong cach layout.js xu
// ly NAV_ITEMS khi permissions null).
const TAB_PERMISSION = {
  users: 'partnerAdminCanManageAccounts',
  org: 'partnerAdminCanManageOrg',
  reportAccess: 'partnerAdminCanManageOrg',
  audit: 'partnerAdminCanViewAuditLog',
  scan: 'partnerAdminCanViewScanLog',
};

function applyTabPermissions() {
  const user = getUser();
  const permissions = (user && user.permissions) || {};
  const tabButtons = Array.from(document.querySelectorAll('#partnerAdminTabs .tab-btn'));
  let firstVisible = null;
  tabButtons.forEach((btn) => {
    const requiredPerm = TAB_PERMISSION[btn.dataset.tab];
    const visible = !requiredPerm || permissions[requiredPerm] !== false;
    btn.classList.toggle('hidden', !visible);
    if (visible && !firstVisible) firstVisible = btn;
  });
  // Neu tab dang active ("users", mac dinh trong HTML) bi an, chuyen sang tab DAU TIEN con hien -
  // tranh man hinh trang (ca tab active lan panel cua no deu an) khi tai khoan khong co quyen
  // "Quan ly tai khoan" nhung co quyen khac.
  const activeBtn = tabButtons.find((b) => b.classList.contains('active'));
  if ((!activeBtn || activeBtn.classList.contains('hidden')) && firstVisible) {
    tabButtons.forEach((b) => b.classList.remove('active'));
    firstVisible.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
    const panel = document.getElementById(`tab${firstVisible.dataset.tab[0].toUpperCase()}${firstVisible.dataset.tab.slice(1)}`);
    if (panel) panel.classList.remove('hidden');
  }
}
applyTabPermissions();

/** Dung chung boi ca click tab THAT lan nut "Tao diem tieu ngay" (xem noUnitHint) - tach rieng
 * ham nay de 2 noi goi cung logic chuyen tab, khong lap code. */
function activateTab(tabKey) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tabKey));
  document.getElementById('tabUsers').classList.toggle('hidden', tabKey !== 'users');
  document.getElementById('tabOrg').classList.toggle('hidden', tabKey !== 'org');
  document.getElementById('tabReportAccess').classList.toggle('hidden', tabKey !== 'reportAccess');
  document.getElementById('tabAudit').classList.toggle('hidden', tabKey !== 'audit');
  document.getElementById('tabScan').classList.toggle('hidden', tabKey !== 'scan');
  if (tabKey === 'org' && !orgLoaded) loadOrg();
  if (tabKey === 'reportAccess' && !groupsLoaded) loadGroups();
  if (tabKey === 'audit' && !auditLoaded) loadAudit();
  if (tabKey === 'scan' && !scanLoaded) loadScan();
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});

/** Nut "Tao diem tieu ngay" trong canh bao noUnitHint (xem refreshNewUserUnitOptions) - nhay
 * thang sang tab "Cong ty & Diem tieu", chon san DUNG cong ty dang dang do o form "Tao tai
 * khoan", con lai chi can go Ten diem tieu roi bam "Tao diem tieu". */
document.getElementById('goCreateUnitBtn').addEventListener('click', () => {
  const companyId = newUserCompany.value;
  activateTab('org');
  if (companyId) {
    // orgLoaded co the vua duoc bat o activateTab() (lan dau mo tab) - doi 1 nhip de
    // newLocationCompany kip co options (loadOrg la async) truoc khi gan gia tri.
    setTimeout(() => { newLocationCompany.value = companyId; }, 150);
  }
  document.getElementById('newLocationName').focus();
});

function detailText(raw) {
  if (!raw) return '-';
  try {
    return JSON.stringify(JSON.parse(raw));
  } catch (err) {
    return raw;
  }
}

let auditLoaded = false;
async function loadAudit() {
  const fromDate = document.getElementById('auditFromDate').value;
  const toDate = document.getElementById('auditToDate').value;
  const params = new URLSearchParams();
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate) params.set('toDate', toDate);

  const auditBody = document.getElementById('auditBody');
  try {
    const rows = await apiFetch(`/partner-admin/audit-log?${params.toString()}`);
    auditLoaded = true;
    auditBody.innerHTML = rows.length
      ? rows
          .map(
            (r) => `
        <tr>
          <td data-label="Thời gian">${fmtDate(r.CreatedDate)}</td>
          <td data-label="Người thực hiện">${escapeHtml(r.ActorUsername)}</td>
          <td data-label="Hành động">${escapeHtml(ACTION_LABEL[r.Action] || r.Action)}</td>
          <td data-label="Đối tượng">${escapeHtml(r.TargetUsername || '-')}</td>
          <td class="fs-13 text-muted" data-label="Chi tiết">${escapeHtml(detailText(r.Detail))}</td>
        </tr>`
          )
          .join('')
      : '<tr><td colspan="5" class="text-muted">Chưa có nhật ký nào</td></tr>';
  } catch (err) {
    showToast(err.message);
  }
}

let scanLoaded = false;
async function loadScan() {
  const fromDate = document.getElementById('scanFromDate').value;
  const toDate = document.getElementById('scanToDate').value;
  const params = new URLSearchParams();
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate) params.set('toDate', toDate);

  const scanBody = document.getElementById('scanBody');
  try {
    scanBody.innerHTML = '<tr><td colspan="7" class="text-muted">Đang tải...</td></tr>';
    const rows = await apiFetch(`/partner-admin/scan-log?${params.toString()}`);
    scanLoaded = true;
    scanBody.innerHTML = rows.length
      ? rows
          .map(
            (r) => `
        <tr>
          <td data-label="Thời gian">${fmtDate(r.CreatedDate)}</td>
          <td data-label="Người quét">${escapeHtml(r.UserName || '-')}</td>
          <td data-label="Địa điểm">${escapeHtml(r.LocationDisplayName || r.LocationsDetail || '-')}</td>
          <td data-label="Mã voucher">${escapeHtml(r.VoucherCode)}</td>
          <td data-label="Cách quét">${escapeHtml(r.ScanMethod)}</td>
          <td data-label="Hành động">${escapeHtml(r.Action)}</td>
          <td data-label="Kết quả">${escapeHtml(r.ResultStatus)}</td>
        </tr>`
          )
          .join('')
      : '<tr><td colspan="7" class="text-muted">Không có dữ liệu trong khoảng đã chọn</td></tr>';
  } catch (err) {
    showToast(err.message);
  }
}

/** Xuat Excel PHAI di qua fetch() kem header Authorization (giong het used-vouchers.js/report.js),
 * khong the dung the <a href> thuong vi API yeu cau dang nhap. Dung chung cho ca 2 tab, chi khac
 * duong dan API va phan ten file tai ve. */
async function exportExcel(btn, apiPath, fromInputId, toInputId, fileNamePrefix) {
  const fromDate = document.getElementById(fromInputId).value;
  const toDate = document.getElementById(toInputId).value;
  const params = new URLSearchParams();
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate) params.set('toDate', toDate);

  btn.disabled = true;
  try {
    const res = await fetch(`/api${apiPath}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `Lỗi xuất Excel (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileNamePrefix}_${fromDate || 'toanbo'}_${toDate || 'toanbo'}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast(err.message);
  } finally {
    btn.disabled = false;
  }
}

document.getElementById('loadAuditBtn').addEventListener('click', loadAudit);
document.getElementById('exportAuditBtn').addEventListener('click', (e) =>
  exportExcel(e.target, '/partner-admin/audit-log/export', 'auditFromDate', 'auditToDate', 'nhat-ky-quan-tri')
);
document.getElementById('loadScanBtn').addEventListener('click', loadScan);
document.getElementById('exportScanBtn').addEventListener('click', (e) =>
  exportExcel(e.target, '/partner-admin/scan-log/export', 'scanFromDate', 'scanToDate', 'hoat-dong-quet-thu-hoi')
);

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

let ownConnectionName = '';
let scopedUsersCache = [];
let ownUnitsCache = [];
let ownCompaniesCache = [];
let ownGroupsCache = [];
let openEditUserId = null;

/** O chon "Cong ty" dung chung cho CA create-form lan bo loc (tach 2 bien DOM rieng - id khac
 * nhau - nhung dung chung 1 nguon du lieu ownCompaniesCache) - diem 1 (gan Cong ty/Diem tieu
 * ngay luc tao) va diem 5/6 (bo loc danh sach) trong cung 1 tab "Quan ly tai khoan". */
function renderCompanySelectOptions(select, placeholder) {
  const current = select.value;
  select.innerHTML =
    `<option value="">${placeholder}</option>` +
    ownCompaniesCache.map((c) => `<option value="${c.Id}">${escapeHtml(c.CompanyName)}${c.CompanyType === 'PARTNER' ? ' (Công ty đối tác)' : ''}</option>`).join('');
  if (ownCompaniesCache.some((c) => String(c.Id) === current)) select.value = current;
}

function unitOptionsForCompany(companyId) {
  const list = companyId ? ownUnitsCache.filter((u) => String(u.CompanyId) === String(companyId)) : ownUnitsCache;
  return list.map((u) => `<option value="${u.Id}">${escapeHtml(u.CompanyName || '')} - ${escapeHtml(u.PartnerName)}</option>`).join('');
}

const newUserSearchInput = document.getElementById('userSearchInput');
const filterCompanySelect = document.getElementById('filterCompany');
const filterUnitSelect = document.getElementById('filterUnit');
const noUnitHint = document.getElementById('noUnitHint');

/** Cong ty duoc chon nhung CHUA co Diem tieu nao (vd HCRC vua tao/gan Cong ty cho doi tac, chua
 * kip tao Diem tieu) - tai khoan KHONG the gan vao dung cong ty do neu khong chon duoc Diem tieu
 * (he thong gan tai khoan qua Diem tieu, khong gan thang vao Cong ty - xem README muc 4m). Hien
 * canh bao ro + nut nhay nhanh sang tab "Cong ty & Diem tieu" thay vi de doi tac bi ket khong
 * hieu vi sao, tranh lap lai chinh van de nguoi dung da bao cao. */
function refreshNewUserUnitOptions() {
  const companyId = newUserCompany.value;
  if (!companyId) {
    newUserUnit.innerHTML = '<option value="">-- Chọn công ty trước --</option>';
    noUnitHint.classList.add('hidden');
    return;
  }
  const opts = unitOptionsForCompany(companyId);
  newUserUnit.innerHTML = opts ? `<option value="">-- Không gán điểm tiêu --</option>${opts}` : '<option value="">-- Công ty này chưa có điểm tiêu nào --</option>';
  noUnitHint.classList.toggle('hidden', !!opts);
}
newUserCompany.addEventListener('change', refreshNewUserUnitOptions);

function refreshFilterUnitOptions() {
  const companyId = filterCompanySelect.value;
  const current = filterUnitSelect.value;
  const list = companyId ? ownUnitsCache.filter((u) => String(u.CompanyId) === String(companyId)) : ownUnitsCache;
  filterUnitSelect.innerHTML = '<option value="">Tất cả điểm tiêu</option>' + list.map((u) => `<option value="${u.Id}">${escapeHtml(u.CompanyName || '')} - ${escapeHtml(u.PartnerName)}</option>`).join('');
  if (list.some((u) => String(u.Id) === current)) filterUnitSelect.value = current;
}
filterCompanySelect.addEventListener('change', () => {
  refreshFilterUnitOptions();
  applyListFilter();
});
filterUnitSelect.addEventListener('change', applyListFilter);
newUserSearchInput.addEventListener('input', applyListFilter);

/** Loc danh sach tai khoan (v3.81, diem 5/6) - ket hop o tim kiem + 2 bo loc Cong ty/Diem tieu,
 * dung lai `data-company-id`/`data-unit-id` da gan san luc renderList() (xem findUnitForRow()).
 * Chon Cong ty nhung KHONG chon rieng 1 Diem tieu = hien TOAN BO tai khoan cua cong ty do. */
function applyListFilter() {
  const term = newUserSearchInput.value.trim().toLowerCase();
  const companyFilter = filterCompanySelect.value;
  const unitFilter = filterUnitSelect.value;
  document.querySelectorAll('#accList .acc-row').forEach((row) => {
    const username = (row.dataset.username || '').toLowerCase();
    const matchTerm = !term || username.includes(term);
    const matchCompany = !companyFilter || row.dataset.companyId === companyFilter;
    const matchUnit = !unitFilter || row.dataset.unitId === unitFilter;
    row.classList.toggle('hidden', !(matchTerm && matchCompany && matchUnit));
  });
}

async function load() {
  const user = getUser();
  // M20 (v3.81): tai khoan khong phai partner-admin nao ca (isPartnerAdmin=false) moi coi la
  // "khong duoc phep" (an ca trang) - tai khoan LA partner-admin nhung bi bo tick het ca 4 tab
  // (hiem, nhung co the xay ra) van duoc vao trang, chi KHONG con tab nao de thao tac (giao dien
  // trong, khong hien thong bao sai la "khong co quyen quan tri doi tac" trong khi thuc ra co).
  if (!user || !user.permissions || !user.permissions.isPartnerAdmin) {
    notAllowedNotice.classList.remove('hidden');
    partnerAdminCard.classList.add('hidden');
    return;
  }
  ownConnectionName = (user.permissions && user.permissions.partnerAdminConnectionName) || '';
  partnerAdminTitle.textContent = ownConnectionName ? `Quản trị đối tác - Hệ thống ${ownConnectionName}` : 'Quản trị đối tác';

  // Goi DOC LAP tung API (khong Promise.all() rang buoc chung) - 1 tab khong duoc cap quyen (vd
  // canManageAccounts=false) se khien DUNG endpoint do tra 403, nhung KHONG duoc lam hong du lieu
  // cua cac tab khac van duoc phep. Tra ve mang rong khi loi, du dung nguyen nhan 403 (khong co
  // quyen tab do, UI tab tuong ung da bi an boi applyTabPermissions() roi) hay loi mang that su.
  const [rows, units, companies, groups] = await Promise.all([
    apiFetch('/partner-admin/users').catch(() => []),
    apiFetch('/partner-admin/units').catch(() => []),
    apiFetch('/partner-admin/companies').catch(() => []),
    apiFetch('/partner-admin/report-access-groups').catch(() => []),
  ]);
  scopedUsersCache = rows;
  // Nap san danh sach diem tieu/cong ty/nhom quyen (dung cho o chon trong "Sua tai khoan" va
  // form tao tai khoan) ngay tu dau, KHONG cho den khi mo cac tab khac - tranh truong hop mo
  // form tao/sua tai khoan truoc khi tung mo cac tab do, o chon se trong khong co gi de chon.
  ownUnitsCache = units;
  ownCompaniesCache = companies;
  ownGroupsCache = groups;
  renderCompanySelectOptions(newUserCompany, '-- Chưa gán công ty --');
  renderCompanySelectOptions(filterCompanySelect, 'Tất cả công ty của bạn');
  refreshNewUserUnitOptions();
  refreshFilterUnitOptions();
  renderList(rows);
  applyListFilter();
}

/** Tim Don vi thu hoi (qua do, Cong ty) 1 tai khoan dang gan, dua vao LocationCode - dung cho
 * data-company-id/data-unit-id tren tung dong (v3.81, diem 5/6) de bo loc hoat dong duoc. */
function findUnitForRow(u) {
  if (!u.locationsDetail) return null;
  return ownUnitsCache.find((unit) => unit.LocationCode === u.locationsDetail) || null;
}

function renderList(rows) {
  if (!rows.length) {
    accList.innerHTML = '<p class="text-muted">Chưa có tài khoản nào - tạo mới ở form bên trên.</p>';
    return;
  }
  accList.innerHTML = rows
    .map((u) => {
      const stateLabel = u.isDeleted ? '<span class="status-badge status-used">ĐÃ KHÓA</span>' : STATE_CHIP[u.state] || '';
      const actionLabel = u.isDeleted ? 'Mở khóa' : 'Khóa';
      const actionClass = u.isDeleted ? 'btn-secondary' : 'btn-danger';
      // Tai khoan dang dung CHUNG them he thong khac (duoc quan tri day du cap them quyen, vd 1
      // tai khoan Fuji tao nhung duoc gan them he thong HCRC de dang nhap 1 lan quet duoc ca 2) -
      // VAN hien de minh bach (doi tac biet tai khoan nay ton tai, dang hoat dong the nao o phan
      // cua ho), nhung AN nut Khoa/Mo khoa - server (setScopedUserActive) cung tu choi 403 neu co
      // gang goi thang API, day chi la an UI cho ro rang, khong phai lop bao ve duy nhat. Thay
      // vao do hien nut "Go he thong [cua ho]" - CHI xoa dung phan cua doi tac nay, KHONG dong
      // den he thong khac tai khoan do dang dung (xem removeOwnConnection()).
      const action = u.exclusiveToThisSystem
        ? `<button type="button" class="${actionClass} toggle-active-btn">${actionLabel}</button>`
        : `<button type="button" class="btn-secondary remove-connection-btn">Gỡ hệ thống ${escapeHtml(ownConnectionName || 'của bạn')}</button>`;
      const sharedBadge = u.exclusiveToThisSystem
        ? ''
        : ' <span class="status-badge status-other">DÙNG CHUNG HỆ THỐNG KHÁC</span>';
      const editPanel = openEditUserId === u.userId ? renderEditPanel(u) : '';
      const unit = findUnitForRow(u);
      return `
      <div class="acc-row" data-user-id="${u.userId}" data-username="${escapeHtml(u.username)}" data-company-id="${unit ? unit.CompanyId : ''}" data-unit-id="${unit ? unit.Id : ''}">
        <div class="acc-row-main">
          <span class="acc-row-name">${escapeHtml(u.username)} — ${escapeHtml(u.fullName || '')}${sharedBadge}</span>
          <span class="acc-row-sub">${stateLabel ? '' : ''}${u.isDeleted ? 'Đã khóa' : 'Đang hoạt động'} · Điểm tiêu: ${escapeHtml(u.locationName || '(chưa gán)')}</span>
        </div>
        <div class="acc-row-right">
          <button type="button" class="btn-secondary edit-user-btn">${openEditUserId === u.userId ? 'Đóng' : 'Sửa'}</button>
          ${action}
        </div>
      </div>
      ${editPanel}`;
    })
    .join('');

  accList.querySelectorAll('.acc-row .toggle-active-btn').forEach((btn) => {
    btn.addEventListener('click', () => toggleActive(btn.closest('.acc-row')));
  });
  accList.querySelectorAll('.acc-row .remove-connection-btn').forEach((btn) => {
    btn.addEventListener('click', () => removeOwnConnection(btn.closest('.acc-row')));
  });
  accList.querySelectorAll('.acc-row .edit-user-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.acc-row');
      const userId = Number(row.dataset.userId);
      openEditUserId = openEditUserId === userId ? null : userId;
      renderList(scopedUsersCache);
      applyListFilter();
    });
  });
  wireEditPanelHandlers();
}

/** O "Sua tai khoan": ho ten/mat khau + 6 quyen tinh nang + diem tieu + nhom quyen xem bao cao
 * (v3.81) - xem phan tich da gui nguoi dung truoc khi lam (mockup). Diem tieu/Nhom quyen bao cao:
 * tai khoan dung CHUNG them he thong khac chi hien DANG CHI XEM (khong doi duoc qua day) - theo
 * dung quyet dinh nguoi dung: chi quan tri day du HCRC moi doi duoc cho tai khoan dung chung. */
function renderEditPanel(u) {
  const extraField = (label, selectHtml, hintHtml) => `
    <label>${label}</label>
    ${selectHtml}
    ${hintHtml || ''}`;

  // v3.97: doi tac khong con tu BAT "Tai khoan doi tac" duoc nua (xem partnerAdminService.js#
  // updateScopedUserCompany) - nhung 1 tai khoan DA duoc HCRC chuyen thanh "Tai khoan doi tac" tu
  // truoc van co the xuat hien trong danh sach nay (tai khoan do CHINH doi tac tao, duoc HCRC sua
  // sau do). Voi tai khoan nay, Diem tieu LUON rong (server da go khi chuyen) nen khong con y
  // nghia gi de cho chon/sua - hien RO RANG la tai khoan doi tac thay vi 1 o chon rong kho hieu.
  const isPartnerAcct = !!(u.permissions && u.permissions.isPartnerAccount);
  const locationField = isPartnerAcct
    ? `
    <label>Điểm tiêu</label>
    <div class="loc-readonly">
      Đây là <strong>Tài khoản đối tác</strong> (do HCRC chuyển) - không gán Điểm tiêu, không thu hồi được voucher.
      Chỉ <strong>quản trị viên HCRC</strong> mới đổi được trạng thái này.
    </div>`
    : u.exclusiveToThisSystem
    ? extraField(
        'Điểm tiêu',
        `<select class="edit-location-select">
          <option value="">(chưa gán)</option>
          ${ownUnitsCache
            .map(
              (unit) =>
                `<option value="${unit.Id}" ${unit.LocationCode === u.locationsDetail ? 'selected' : ''}>${escapeHtml(unit.CompanyName || '')} - ${escapeHtml(unit.PartnerName)}</option>`
            )
            .join('')}
        </select>`,
        '<p class="hint" style="margin-top:4px;">Chỉ hiện các điểm tiêu do bạn tạo, hoặc do HCRC tạo và gán cho bạn (tab "Công ty &amp; Điểm tiêu").</p>'
      )
    : `
    <label>Điểm tiêu</label>
    <div class="loc-readonly">
      Điểm tiêu hiện tại: <strong>${escapeHtml(u.locationName || '(chưa gán)')}</strong> — tài khoản này đang dùng chung hệ thống khác,
      chỉ <strong>quản trị viên HCRC</strong> mới đổi được điểm tiêu cho tài khoản dùng chung. Liên hệ HCRC nếu cần thay đổi.
    </div>`;

  // v3.97: "Cong ty"/"Tai khoan doi tac" chuyen thanh CHI XEM (truoc day la select + checkbox cho
  // doi tac tu sua) - chi hien dong nay khi co gi do THAT SU dang gan (companyId hoac da la tai
  // khoan doi tac), giu giao dien gon nhu truoc khi co tinh nang nay (v3.94) cho da so tai khoan
  // thuong (khong gan Cong ty truc tiep).
  const linkedCompany = u.permissions && u.permissions.companyId ? ownCompaniesCache.find((c) => c.Id === u.permissions.companyId) : null;
  const companyField =
    linkedCompany || isPartnerAcct
      ? `
    <label class="mt-10">Công ty</label>
    <div class="loc-readonly">
      ${linkedCompany ? escapeHtml(linkedCompany.CompanyName) : '(chưa gán)'}${isPartnerAcct ? ' — <strong>Tài khoản đối tác</strong>' : ''}
      — chỉ <strong>quản trị viên HCRC</strong> mới gán/đổi được.
    </div>`
      : '';

  const reportAccessField = u.exclusiveToThisSystem
    ? extraField(
        'Nhóm quyền xem báo cáo',
        `<select class="edit-report-access-select">
          <option value="">-- Mặc định: chỉ xem công ty của điểm tiêu trên --</option>
          ${ownGroupsCache
            .map(
              (g) =>
                `<option value="${g.Id}" ${g.Id === u.reportAccessGroupId ? 'selected' : ''}>${escapeHtml(g.GroupName)} (${g.ScopeType === 'ALL' ? 'toàn bộ công ty của bạn' : `${g.companies.length} công ty`})</option>`
            )
            .join('')}
        </select>`,
        '<p class="hint" style="margin-top:4px;">Chỉ hiện các nhóm quyền do chính bạn tạo (tab "Nhóm quyền xem báo cáo").</p>'
      )
    : `
    <label>Nhóm quyền xem báo cáo</label>
    <div class="loc-readonly">
      Hiện tại: <strong>${escapeHtml(u.reportAccessGroupName || 'Mặc định')}</strong> — chỉ quản trị viên HCRC mới đổi được cho tài khoản dùng chung.
    </div>`;

  return `
  <div class="edit-panel" data-edit-panel="${u.userId}">
    <h4>Sửa tài khoản: ${escapeHtml(u.username)}</h4>
    <label>Họ tên</label>
    <input class="edit-fullname" value="${escapeHtml(u.fullName || '')}" />
    <label>Đặt lại mật khẩu (để trống = giữ nguyên)</label>
    <input class="edit-password" type="password" placeholder="Nhập mật khẩu mới nếu muốn đổi" />

    <label class="mt-10" style="display:block;">Quyền tính năng</label>
    <div class="perm-grid">
      <label class="perm-item"><input type="checkbox" class="checkbox-input edit-perm" data-perm="canRedeemVoucher" ${u.permissions && u.permissions.canRedeemVoucher ? 'checked' : ''} /> Thu hồi voucher</label>
      <label class="perm-item"><input type="checkbox" class="checkbox-input edit-perm" data-perm="canViewReconciliation" ${u.permissions && u.permissions.canViewReconciliation ? 'checked' : ''} /> Báo cáo đối soát</label>
      <label class="perm-item"><input type="checkbox" class="checkbox-input edit-perm" data-perm="canViewSummary" ${u.permissions && u.permissions.canViewSummary ? 'checked' : ''} /> Báo cáo tổng hợp</label>
      <label class="perm-item"><input type="checkbox" class="checkbox-input edit-perm" data-perm="canViewUsedVouchers" ${u.permissions && u.permissions.canViewUsedVouchers ? 'checked' : ''} /> Voucher đã sử dụng</label>
      <label class="perm-item"><input type="checkbox" class="checkbox-input edit-perm" data-perm="canViewBusinessGuide" ${u.permissions && u.permissions.canViewBusinessGuide ? 'checked' : ''} /> Hướng dẫn nghiệp vụ</label>
      <label class="perm-item"><input type="checkbox" class="checkbox-input edit-perm" data-perm="canViewSystemGuide" ${u.permissions && u.permissions.canViewSystemGuide ? 'checked' : ''} /> Hướng dẫn hệ thống</label>
      <label class="perm-item"><input type="checkbox" class="checkbox-input edit-perm" data-perm="canManageEmailSchedules" ${u.permissions && u.permissions.canManageEmailSchedules ? 'checked' : ''} /> Lịch gửi email báo cáo</label>
    </div>

    ${companyField}

    ${locationField}
    ${reportAccessField}

    <div class="flex gap-10 mt-16">
      <button type="button" class="btn-primary save-edit-btn">Lưu thay đổi</button>
    </div>
  </div>`;
}

function wireEditPanelHandlers() {
  accList.querySelectorAll('.save-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => saveEdit(btn.closest('.edit-panel')));
  });
}

async function saveEdit(panel) {
  const userId = Number(panel.dataset.editPanel);
  const row = scopedUsersCache.find((u) => u.userId === userId);
  const username = row ? row.username : String(userId);
  const fullName = panel.querySelector('.edit-fullname').value.trim();
  const password = panel.querySelector('.edit-password').value;
  const perms = {};
  panel.querySelectorAll('.edit-perm').forEach((cb) => {
    perms[cb.dataset.perm] = cb.checked;
  });
  const locationSelect = panel.querySelector('.edit-location-select');
  const reportAccessSelect = panel.querySelector('.edit-report-access-select');

  const btn = panel.querySelector('.save-edit-btn');
  btn.disabled = true;
  try {
    await apiFetch(`/partner-admin/users/${userId}/profile`, {
      method: 'PUT',
      body: JSON.stringify({ fullName, password, username }),
    });
    await apiFetch(`/partner-admin/users/${userId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ ...perms, username }),
    });
    // v3.97: doi tac khong con tu gan Cong ty/bat "Tai khoan doi tac" duoc nua (xem
    // partnerAdminService.js#updateScopedUserCompany) - bo luon request nay, chi HCRC moi lam
    // duoc qua man "Tai khoan" (users.html).
    if (locationSelect) {
      await apiFetch(`/partner-admin/users/${userId}/location`, {
        method: 'PUT',
        body: JSON.stringify({ redemptionUnitId: locationSelect.value || null, username }),
      });
    }
    if (reportAccessSelect) {
      await apiFetch(`/partner-admin/users/${userId}/report-access-group`, {
        method: 'PUT',
        body: JSON.stringify({ reportAccessGroupId: reportAccessSelect.value || null, username }),
      });
    }
    showToast(`Đã lưu thay đổi cho tài khoản "${username}"`);
    openEditUserId = null;
    await load();
  } catch (err) {
    showToast(err.message);
    btn.disabled = false;
  }
}

async function toggleActive(row) {
  const userId = row.dataset.userId;
  const username = row.dataset.username;
  const isCurrentlyLocked = row.querySelector('.toggle-active-btn').textContent.trim() === 'Mở khóa';
  const isDeleted = !isCurrentlyLocked;
  const confirmMsg = isDeleted
    ? `Khóa tài khoản "${username}"? Tài khoản sẽ không đăng nhập được nữa - có thể mở khóa lại sau.`
    : `Mở khóa tài khoản "${username}"?`;
  if (!confirm(confirmMsg)) return;

  const btn = row.querySelector('.toggle-active-btn');
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

async function removeOwnConnection(row) {
  const userId = row.dataset.userId;
  const username = row.dataset.username;
  const label = ownConnectionName || 'của bạn';
  if (!confirm(`Gỡ quyền dùng hệ thống "${label}" khỏi tài khoản "${username}"? Tài khoản sẽ không còn hiện trong danh sách của bạn nữa (phần hệ thống khác của tài khoản này không bị ảnh hưởng).`)) return;

  const btn = row.querySelector('.remove-connection-btn');
  btn.disabled = true;
  try {
    await apiFetch(`/partner-admin/users/${encodeURIComponent(userId)}/remove-connection`, {
      method: 'PUT',
      body: JSON.stringify({ username }),
    });
    showToast(`Đã gỡ hệ thống "${label}" khỏi tài khoản "${username}"`);
    load();
  } catch (err) {
    showToast(err.message);
    btn.disabled = false;
  }
}

// ===== Tab "Cong ty & Diem tieu" (v3.76, mo rong Sua/Xoa o v3.81 - diem 3) =====
let orgLoaded = false;
let editingOwnCompanyId = null;
let editingOwnUnitId = null;

async function loadOrg() {
  try {
    const [companies, units] = await Promise.all([
      apiFetch('/partner-admin/companies'),
      apiFetch('/partner-admin/units'),
    ]);
    orgLoaded = true;
    ownCompaniesCache = companies;
    ownUnitsCache = units;
    // "Cong ty doi tac" (CompanyType = 'PARTNER', xem sql/043) khong the gan Diem tieu - an khoi
    // o chon "Thuoc cong ty" cua form "Tao diem tieu" (server cung tu chan, xem redemptionUnitService.js).
    const redemptionCompanies = companies.filter((c) => c.CompanyType !== 'PARTNER');
    newLocationCompany.innerHTML = redemptionCompanies.length
      ? redemptionCompanies.map((c) => `<option value="${c.Id}">${escapeHtml(c.CompanyName)}</option>`).join('')
      : '<option value="">Chưa có công ty thu hồi - tạo công ty trước</option>';
    renderCompanySelectOptions(newUserCompany, '-- Chưa gán công ty --');
    renderCompanySelectOptions(filterCompanySelect, 'Tất cả công ty của bạn');
    // Dong bo lai ca o "Diem tieu" cua form "Tao tai khoan" + bo loc - vua tao/xoa 1 diem tieu o
    // tab nay (vd qua nut "Tao diem tieu ngay" trong noUnitHint) phai thay ngay khi quay lai tab
    // "Quan ly tai khoan", khong can doi cong ty qua lai moi lam moi duoc.
    refreshNewUserUnitOptions();
    refreshFilterUnitOptions();
    renderOrg();
  } catch (err) {
    showToast(err.message);
  }
}

function renderOrg() {
  if (!ownCompaniesCache.length) {
    orgList.innerHTML = '<p class="text-muted">Chưa có công ty nào - tạo công ty ở form bên trên trước.</p>';
    return;
  }
  // "Thuoc chinh minh" = CreatedByPartnerConnectionId cua cong ty nay DUNG LA connection cua
  // chinh doi tac dang xem - MOI cong ty tra ve o day da qua dieu kien nay roi (API chi tra ve
  // dung pham vi), nen o day luon la true - tru TRUONG HOP cong ty do HCRC tao va GAN cho doi
  // tac (van thuoc dung pham vi, nhung "chu thuc su" la HCRC) - server tu chan sua/xoa qua
  // companyService.isOwnedByConnection() giong nhau cho ca 2 truong hop (dung 1 dieu kien), nen
  // frontend o day KHONG the phan biet duoc "tu tao" voi "HCRC gan cho" chi tu du lieu co san.
  // Vi vay LUON hien nut Sua/Xoa cho moi cong ty trong danh sach nay (ca 2 truong hop deu sua/xoa
  // duoc that theo dung thiet ke "HCRC gan = dung duoc nhu cua minh") - khac voi demo ban dau (co
  // badge rieng cho cong ty HCRC gan, chi de MINH HOA y tuong, khong phai gioi han that su).
  orgList.innerHTML = ownCompaniesCache
    .map((c) => {
      const units = ownUnitsCache.filter((u) => u.CompanyId === c.Id);
      // v3.85 (muc 6): gom san 1 chuoi tim kiem (ma/ten cong ty + ten tung diem tieu) vao
      // data-search, loc bang CSS hide/show o applyOrgFilter() - dung CHUNG kieu voi
      // applyListFilter() cua tab "Quan ly tai khoan" o tren, khong re-render lai cache.
      const searchTerm = [c.CompanyCode, c.CompanyName, ...units.map((u) => u.PartnerName)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const isPartnerCompany = c.CompanyType === 'PARTNER';
      return `
      <div class="company-card" data-company-id="${c.Id}" data-search="${escapeHtml(searchTerm)}">
        <div class="company-card-head">
          <span class="company-name">
            ${escapeHtml(c.CompanyName)}${c.Address ? ` <span class="text-muted" style="font-size:12px; font-weight:400;">· ${escapeHtml(c.Address)}</span>` : ''}
            <span class="status-badge ${isPartnerCompany ? 'status-other' : 'status-unused'}" style="margin-left:6px;">${isPartnerCompany ? 'CÔNG TY ĐỐI TÁC' : 'CÔNG TY THU HỒI'}</span>
          </span>
          <span style="display:flex; align-items:center; gap:8px;">
            <span class="text-muted" style="font-size:12px;">${isPartnerCompany ? 'không áp dụng' : units.length + ' điểm tiêu'}</span>
            <button type="button" class="btn-secondary edit-company-btn" style="padding:4px 10px; font-size:12.5px;">Sửa</button>
            <button type="button" class="btn-danger delete-company-btn" style="padding:4px 10px; font-size:12.5px;">Xóa</button>
          </span>
        </div>
        ${units
          .map(
            (u) => `
          <span class="unit-chip"${u.Address ? ` title="${escapeHtml(u.Address)}"` : ''}>
            ${escapeHtml(u.PartnerName)}
            <button type="button" class="edit-unit-btn" data-id="${u.Id}" title="Sửa điểm tiêu" style="border:none;background:none;cursor:pointer;margin-left:4px;">✎</button>
            <button type="button" class="delete-unit-btn" data-id="${u.Id}" title="Xóa điểm tiêu" style="border:none;background:none;cursor:pointer;color:var(--danger,#d33);">✕</button>
          </span>`
          )
          .join('') || (isPartnerCompany ? '' : '<span class="text-muted" style="font-size:12.5px;">Chưa có điểm tiêu nào</span>')}
      </div>`;
    })
    .join('');
  applyOrgFilter();

  orgList.querySelectorAll('.edit-company-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.closest('.company-card').dataset.companyId);
      const company = ownCompaniesCache.find((c) => c.Id === id);
      if (company) populateCompanyEditForm(company);
    });
  });
  orgList.querySelectorAll('.delete-company-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteOwnCompany(Number(btn.closest('.company-card').dataset.companyId)));
  });
  orgList.querySelectorAll('.edit-unit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const unit = ownUnitsCache.find((u) => u.Id === Number(btn.dataset.id));
      if (unit) populateUnitEditForm(unit);
    });
  });
  orgList.querySelectorAll('.delete-unit-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteOwnUnit(Number(btn.dataset.id)));
  });
}

/** v3.85 (muc 6): loc "Cong ty & diem tieu cua ban" theo o tim kiem - CSS hide/show tren cac
 * .company-card da gan san data-search luc renderOrg(), khong re-render lai tu cache. */
function applyOrgFilter() {
  const term = orgSearchInput.value.trim().toLowerCase();
  orgList.querySelectorAll('.company-card').forEach((card) => {
    const haystack = card.dataset.search || '';
    card.classList.toggle('hidden', !!term && !haystack.includes(term));
  });
}
orgSearchInput.addEventListener('input', applyOrgFilter);

// v3.97 (theo yeu cau nguoi dung): doi tac khong con tu tao/chuyen "Cong ty doi tac" duoc nua -
// chi HCRC moi lam duoc. O "Loai cong ty" bo han khoi form (khong con chon duoc), thay bang 1
// dong CHI XEM khi cong ty dang sua DA la "Cong ty doi tac" (do HCRC thiet lap) de doi tac van
// biet ro, chi khong sua duoc.
const companyTypeNotice = document.getElementById('companyTypeNotice');

function populateCompanyEditForm(c) {
  editingOwnCompanyId = c.Id;
  companyFormTitle.textContent = `Sửa công ty: ${c.CompanyName}`;
  document.getElementById('newCompanyCode').value = c.CompanyCode || '';
  document.getElementById('newCompanyName').value = c.CompanyName || '';
  document.getElementById('newCompanyAddress').value = c.Address || '';
  if (c.CompanyType === 'PARTNER') {
    companyTypeNotice.textContent = 'Đây là "Công ty đối tác" (do HCRC thiết lập) - không có điểm tiêu, tài khoản gắn vào không thu hồi được. Chỉ HCRC mới đổi lại loại công ty này.';
    companyTypeNotice.classList.remove('hidden');
  } else {
    companyTypeNotice.classList.add('hidden');
  }
  createCompanyBtn.textContent = 'Cập nhật công ty';
  cancelCompanyEditBtn.classList.remove('hidden');
  createCompanyBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetCompanyEditForm() {
  editingOwnCompanyId = null;
  companyFormTitle.textContent = 'Tạo công ty mới';
  document.getElementById('newCompanyCode').value = '';
  document.getElementById('newCompanyName').value = '';
  document.getElementById('newCompanyAddress').value = '';
  companyTypeNotice.classList.add('hidden');
  createCompanyBtn.textContent = 'Tạo công ty';
  cancelCompanyEditBtn.classList.add('hidden');
}
cancelCompanyEditBtn.addEventListener('click', resetCompanyEditForm);

async function deleteOwnCompany(id) {
  const company = ownCompaniesCache.find((c) => c.Id === id);
  if (!company) return;
  if (!confirm(`Xóa công ty "${company.CompanyName}"? Không thể hoàn tác.`)) return;
  try {
    await apiFetch(`/partner-admin/companies/${id}`, { method: 'DELETE' });
    showToast('Đã xóa công ty');
    if (editingOwnCompanyId === id) resetCompanyEditForm();
    await loadOrg();
  } catch (err) {
    showToast(err.message);
  }
}

function populateUnitEditForm(u) {
  editingOwnUnitId = u.Id;
  unitFormTitle.textContent = `Sửa điểm tiêu: ${u.PartnerName}`;
  document.getElementById('newLocationName').value = u.PartnerName || '';
  newLocationCompany.value = String(u.CompanyId || '');
  document.getElementById('newLocationAddress').value = u.Address || '';
  createUnitBtn.textContent = 'Cập nhật điểm tiêu';
  cancelUnitEditBtn.classList.remove('hidden');
  createUnitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetUnitEditForm() {
  editingOwnUnitId = null;
  unitFormTitle.textContent = 'Tạo điểm tiêu mới';
  document.getElementById('newLocationName').value = '';
  document.getElementById('newLocationAddress').value = '';
  createUnitBtn.textContent = 'Tạo điểm tiêu';
  cancelUnitEditBtn.classList.add('hidden');
}
cancelUnitEditBtn.addEventListener('click', resetUnitEditForm);

async function deleteOwnUnit(id) {
  const unit = ownUnitsCache.find((u) => u.Id === id);
  if (!unit) return;
  if (!confirm(`Xóa điểm tiêu "${unit.PartnerName}"? Không thể hoàn tác.`)) return;
  try {
    await apiFetch(`/partner-admin/units/${id}`, { method: 'DELETE' });
    showToast('Đã xóa điểm tiêu');
    if (editingOwnUnitId === id) resetUnitEditForm();
    await loadOrg();
  } catch (err) {
    showToast(err.message);
  }
}

createCompanyBtn.addEventListener('click', async () => {
  const companyCode = document.getElementById('newCompanyCode').value.trim();
  const companyName = document.getElementById('newCompanyName').value.trim();
  const address = document.getElementById('newCompanyAddress').value.trim();
  if (!companyCode || !companyName) return showToast('Vui lòng nhập Mã công ty và Tên công ty');

  createCompanyBtn.disabled = true;
  try {
    if (editingOwnCompanyId) {
      await apiFetch(`/partner-admin/companies/${editingOwnCompanyId}`, { method: 'PUT', body: JSON.stringify({ companyCode, companyName, address }) });
      showToast(`Đã cập nhật công ty "${companyName}"`);
      resetCompanyEditForm();
    } else {
      await apiFetch('/partner-admin/companies', { method: 'POST', body: JSON.stringify({ companyCode, companyName, address }) });
      showToast(`Đã tạo công ty "${companyName}"`);
      document.getElementById('newCompanyCode').value = '';
      document.getElementById('newCompanyName').value = '';
      document.getElementById('newCompanyAddress').value = '';
    }
    await loadOrg();
  } catch (err) {
    showToast(err.message);
  } finally {
    createCompanyBtn.disabled = false;
  }
});

createUnitBtn.addEventListener('click', async () => {
  const locationName = document.getElementById('newLocationName').value.trim();
  const companyId = newLocationCompany.value;
  const address = document.getElementById('newLocationAddress').value.trim();
  if (!locationName) return showToast('Vui lòng nhập Tên điểm tiêu');
  if (!companyId) return showToast('Vui lòng tạo công ty trước khi tạo điểm tiêu');

  createUnitBtn.disabled = true;
  try {
    if (editingOwnUnitId) {
      await apiFetch(`/partner-admin/units/${editingOwnUnitId}`, { method: 'PUT', body: JSON.stringify({ locationName, companyId, address }) });
      showToast(`Đã cập nhật điểm tiêu "${locationName}"`);
      resetUnitEditForm();
    } else {
      await apiFetch('/partner-admin/units', { method: 'POST', body: JSON.stringify({ locationName, companyId, address }) });
      showToast(`Đã tạo điểm tiêu "${locationName}"`);
      document.getElementById('newLocationName').value = '';
      document.getElementById('newLocationAddress').value = '';
    }
    await loadOrg();
  } catch (err) {
    showToast(err.message);
  } finally {
    createUnitBtn.disabled = false;
  }
});

// ===== Tab "Nhom quyen xem bao cao" (v3.81, diem 8/9) =====
let groupsLoaded = false;
let editingOwnGroupId = null;
const groupFormTitle = document.getElementById('groupFormTitle');
const newGroupScope = document.getElementById('newGroupScope');
const groupCompaniesField = document.getElementById('groupCompaniesField');
const groupCompaniesList = document.getElementById('groupCompaniesList');
const createGroupBtn = document.getElementById('createGroupBtn');
const cancelGroupEditBtn = document.getElementById('cancelGroupEditBtn');
const groupList = document.getElementById('groupList');

function renderGroupCompanyCheckboxes() {
  // "Cong ty doi tac" (CompanyType = 'PARTNER') khong bao gio co du lieu bao cao - an khoi danh
  // sach cap quyen xem cheo bao cao, giong het units.js#renderGroupCompaniesCheckboxes.
  const reportCompanies = ownCompaniesCache.filter((c) => c.CompanyType !== 'PARTNER');
  if (!reportCompanies.length) {
    groupCompaniesList.innerHTML = '<span class="text-muted">Chưa có công ty nào - tạo công ty ở tab "Công ty &amp; Điểm tiêu" trước.</span>';
    return;
  }
  groupCompaniesList.innerHTML = reportCompanies
    .map((c) => `
      <label class="checkbox-inline">
        <input type="checkbox" class="groupCompanyCheckbox" value="${c.Id}" />
        ${escapeHtml(c.CompanyName)}
      </label>`)
    .join('');
}

function toggleGroupCompaniesField() {
  groupCompaniesField.style.display = newGroupScope.value === 'SPECIFIC' ? '' : 'none';
}
newGroupScope.addEventListener('change', toggleGroupCompaniesField);
toggleGroupCompaniesField();

async function loadGroups() {
  try {
    ownGroupsCache = await apiFetch('/partner-admin/report-access-groups');
    groupsLoaded = true;
    renderGroupCompanyCheckboxes();
    renderGroups();
  } catch (err) {
    showToast(err.message);
  }
}

function renderGroups() {
  if (!ownGroupsCache.length) {
    groupList.innerHTML = '<p class="text-muted">Chưa có nhóm quyền nào - tạo ở form bên trái.</p>';
    return;
  }
  groupList.innerHTML = ownGroupsCache
    .map(
      (g) => `
      <div class="company-card" data-group-id="${g.Id}">
        <div class="company-card-head">
          <span class="company-name">${escapeHtml(g.GroupName)}</span>
          <span style="display:flex; align-items:center; gap:8px;">
            <span class="text-muted" style="font-size:12px;">${g.ScopeType === 'ALL' ? 'Toàn bộ công ty của bạn' : `${g.companies.length} công ty được chọn`}</span>
            <button type="button" class="btn-secondary edit-group-btn" style="padding:4px 10px; font-size:12.5px;">Sửa</button>
            <button type="button" class="btn-danger delete-group-btn" style="padding:4px 10px; font-size:12.5px;">Xóa</button>
          </span>
        </div>
        ${g.ScopeType === 'SPECIFIC' ? g.companies.map((c) => `<span class="unit-chip">${escapeHtml(c.companyName)}</span>`).join('') : ''}
      </div>`
    )
    .join('');

  groupList.querySelectorAll('.edit-group-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.closest('.company-card').dataset.groupId);
      const group = ownGroupsCache.find((g) => g.Id === id);
      if (group) populateGroupEditForm(group);
    });
  });
  groupList.querySelectorAll('.delete-group-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteOwnGroup(Number(btn.closest('.company-card').dataset.groupId)));
  });
}

function populateGroupEditForm(g) {
  editingOwnGroupId = g.Id;
  groupFormTitle.textContent = `Sửa nhóm quyền: ${g.GroupName}`;
  document.getElementById('newGroupName').value = g.GroupName || '';
  newGroupScope.value = g.ScopeType;
  toggleGroupCompaniesField();
  renderGroupCompanyCheckboxes();
  const companyIds = (g.companies || []).map((c) => c.companyId);
  document.querySelectorAll('.groupCompanyCheckbox').forEach((cb) => {
    cb.checked = companyIds.includes(Number(cb.value));
  });
  createGroupBtn.textContent = 'Cập nhật nhóm quyền';
  cancelGroupEditBtn.classList.remove('hidden');
  createGroupBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetGroupEditForm() {
  editingOwnGroupId = null;
  groupFormTitle.textContent = 'Thêm nhóm quyền';
  document.getElementById('newGroupName').value = '';
  newGroupScope.value = 'SPECIFIC';
  toggleGroupCompaniesField();
  renderGroupCompanyCheckboxes();
  createGroupBtn.textContent = 'Lưu nhóm quyền';
  cancelGroupEditBtn.classList.add('hidden');
}
cancelGroupEditBtn.addEventListener('click', resetGroupEditForm);

async function deleteOwnGroup(id) {
  const group = ownGroupsCache.find((g) => g.Id === id);
  if (!group) return;
  if (!confirm(`Xóa nhóm quyền "${group.GroupName}"? Không thể hoàn tác.`)) return;
  try {
    await apiFetch(`/partner-admin/report-access-groups/${id}`, { method: 'DELETE' });
    showToast('Đã xóa nhóm quyền');
    if (editingOwnGroupId === id) resetGroupEditForm();
    await loadGroups();
  } catch (err) {
    showToast(err.message);
  }
}

createGroupBtn.addEventListener('click', async () => {
  const groupName = document.getElementById('newGroupName').value.trim();
  const scopeType = newGroupScope.value;
  const companyIds = Array.from(document.querySelectorAll('.groupCompanyCheckbox:checked')).map((el) => Number(el.value));
  if (!groupName) return showToast('Vui lòng nhập Tên nhóm');
  if (scopeType === 'SPECIFIC' && !companyIds.length) return showToast('Vui lòng chọn ít nhất 1 công ty');

  const payload = { groupName, scopeType, companyIds };
  createGroupBtn.disabled = true;
  try {
    if (editingOwnGroupId) {
      await apiFetch(`/partner-admin/report-access-groups/${editingOwnGroupId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Đã cập nhật nhóm quyền');
      resetGroupEditForm();
    } else {
      await apiFetch('/partner-admin/report-access-groups', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Đã lưu nhóm quyền');
      document.getElementById('newGroupName').value = '';
    }
    await loadGroups();
  } catch (err) {
    showToast(err.message);
  } finally {
    createGroupBtn.disabled = false;
  }
});

createForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newPassword').value;
  const fullName = document.getElementById('newFullName').value.trim();
  const redemptionUnitId = newUserUnit.value || null;
  const companyId = newUserCompany.value || null;

  createBtn.disabled = true;
  try {
    await apiFetch('/partner-admin/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, fullName, redemptionUnitId, companyId }),
    });
    showToast(`Đã tạo tài khoản "${username}"`);
    createForm.reset();
    newUserUnit.innerHTML = '<option value="">-- Chọn công ty trước --</option>';
    load();
  } catch (err) {
    showToast(err.message);
  } finally {
    createBtn.disabled = false;
  }
});

load();
