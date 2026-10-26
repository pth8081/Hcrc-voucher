requireAuth();
renderTopbar('partner-admin');

const notAllowedNotice = document.getElementById('notAllowedNotice');
const partnerAdminCard = document.getElementById('partnerAdminCard');
const partnerAdminTitle = document.getElementById('partnerAdminTitle');
const accList = document.getElementById('accList');
const createForm = document.getElementById('createForm');
const createBtn = document.getElementById('createBtn');

const orgList = document.getElementById('orgList');
const newLocationCompany = document.getElementById('newLocationCompany');
const createCompanyBtn = document.getElementById('createCompanyBtn');
const createUnitBtn = document.getElementById('createUnitBtn');

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
  PARTNER_ADMIN_CREATE_COMPANY: 'Bạn tạo công ty',
  PARTNER_ADMIN_CREATE_UNIT: 'Bạn tạo điểm tiêu',
};

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tabUsers').classList.toggle('hidden', btn.dataset.tab !== 'users');
    document.getElementById('tabOrg').classList.toggle('hidden', btn.dataset.tab !== 'org');
    document.getElementById('tabAudit').classList.toggle('hidden', btn.dataset.tab !== 'audit');
    document.getElementById('tabScan').classList.toggle('hidden', btn.dataset.tab !== 'scan');
    if (btn.dataset.tab === 'org' && !orgLoaded) loadOrg();
    if (btn.dataset.tab === 'audit' && !auditLoaded) loadAudit();
    if (btn.dataset.tab === 'scan' && !scanLoaded) loadScan();
  });
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
          <td data-label="Địa điểm">${escapeHtml(r.LocationsDetail || '-')}</td>
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
let openEditUserId = null;

async function load() {
  try {
    const user = getUser();
    ownConnectionName = (user && user.permissions && user.permissions.partnerAdminConnectionName) || '';
    partnerAdminTitle.textContent = ownConnectionName ? `Quản trị đối tác - Hệ thống ${ownConnectionName}` : 'Quản trị đối tác';

    const [rows, units] = await Promise.all([apiFetch('/partner-admin/users'), apiFetch('/partner-admin/units')]);
    scopedUsersCache = rows;
    // Nap san danh sach diem tieu cua chinh doi tac (dung cho o chon trong "Sua tai khoan") ngay
    // tu dau, KHONG cho den khi mo tab "Cong ty & Diem tieu" - tranh truong hop bam "Sua" 1 tai
    // khoan truoc khi tung mo tab do, o chon se trong khong co gi de chon.
    ownUnitsCache = units;
    renderList(rows);
  } catch (err) {
    notAllowedNotice.classList.remove('hidden');
    partnerAdminCard.classList.add('hidden');
  }
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
      return `
      <div class="acc-row" data-user-id="${u.userId}" data-username="${escapeHtml(u.username)}">
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
    });
  });
  wireEditPanelHandlers();
}

/** O "Sua tai khoan" (v3.76): ho ten/mat khau + 6 quyen tinh nang + diem tieu - xem phan tich
 * da gui nguoi dung truoc khi lam (mockup). Diem tieu: tai khoan dung CHUNG them he thong khac
 * chi hien DANG CHI XEM (khong doi duoc qua day) - theo dung quyet dinh nguoi dung: chi quan tri
 * day du HCRC moi doi diem tieu cho tai khoan dung chung duoc. */
function renderEditPanel(u) {
  const locationField = u.exclusiveToThisSystem
    ? `
    <label>Điểm tiêu</label>
    <select class="edit-location-select">
      <option value="">(chưa gán)</option>
      ${ownUnitsCache
        .map(
          (unit) =>
            `<option value="${unit.Id}" ${unit.LocationCode === u.locationsDetail ? 'selected' : ''}>${escapeHtml(unit.CompanyName || '')} - ${escapeHtml(unit.PartnerName)}</option>`
        )
        .join('')}
    </select>
    <p class="hint" style="margin-top:4px;">Chỉ hiện các điểm tiêu do bạn tạo (tab "Công ty &amp; Điểm tiêu").</p>`
    : `
    <label>Điểm tiêu</label>
    <div class="loc-readonly">
      Điểm tiêu hiện tại: <strong>${escapeHtml(u.locationName || '(chưa gán)')}</strong> — tài khoản này đang dùng chung hệ thống khác,
      chỉ <strong>quản trị viên HCRC</strong> mới đổi được điểm tiêu cho tài khoản dùng chung. Liên hệ HCRC nếu cần thay đổi.
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
    </div>

    ${locationField}

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
    if (locationSelect) {
      await apiFetch(`/partner-admin/users/${userId}/location`, {
        method: 'PUT',
        body: JSON.stringify({ redemptionUnitId: locationSelect.value || null, username }),
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

// ===== Tab "Cong ty & Diem tieu" (v3.76) =====
let orgLoaded = false;
let ownCompaniesCache = [];

async function loadOrg() {
  try {
    const [companies, units] = await Promise.all([
      apiFetch('/partner-admin/companies'),
      apiFetch('/partner-admin/units'),
    ]);
    orgLoaded = true;
    ownCompaniesCache = companies;
    ownUnitsCache = units;
    newLocationCompany.innerHTML = companies.length
      ? companies.map((c) => `<option value="${c.Id}">${escapeHtml(c.CompanyName)}</option>`).join('')
      : '<option value="">Chưa có công ty - tạo công ty trước</option>';
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
  orgList.innerHTML = ownCompaniesCache
    .map((c) => {
      const units = ownUnitsCache.filter((u) => u.CompanyId === c.Id);
      return `
      <div class="company-card">
        <div class="company-card-head">
          <span class="company-name">${escapeHtml(c.CompanyName)}</span>
          <span class="text-muted" style="font-size:12px;">${units.length} điểm tiêu</span>
        </div>
        ${units.map((u) => `<span class="unit-chip">${escapeHtml(u.PartnerName)}</span>`).join('') || '<span class="text-muted" style="font-size:12.5px;">Chưa có điểm tiêu nào</span>'}
      </div>`;
    })
    .join('');
}

createCompanyBtn.addEventListener('click', async () => {
  const companyCode = document.getElementById('newCompanyCode').value.trim();
  const companyName = document.getElementById('newCompanyName').value.trim();
  if (!companyCode || !companyName) return showToast('Vui lòng nhập Mã công ty và Tên công ty');

  createCompanyBtn.disabled = true;
  try {
    await apiFetch('/partner-admin/companies', { method: 'POST', body: JSON.stringify({ companyCode, companyName }) });
    showToast(`Đã tạo công ty "${companyName}"`);
    document.getElementById('newCompanyCode').value = '';
    document.getElementById('newCompanyName').value = '';
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
  if (!locationName) return showToast('Vui lòng nhập Tên điểm tiêu');
  if (!companyId) return showToast('Vui lòng tạo công ty trước khi tạo điểm tiêu');

  createUnitBtn.disabled = true;
  try {
    await apiFetch('/partner-admin/units', { method: 'POST', body: JSON.stringify({ locationName, companyId }) });
    showToast(`Đã tạo điểm tiêu "${locationName}"`);
    document.getElementById('newLocationName').value = '';
    await loadOrg();
  } catch (err) {
    showToast(err.message);
  } finally {
    createUnitBtn.disabled = false;
  }
});

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
