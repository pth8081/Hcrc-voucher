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
};

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tabUsers').classList.toggle('hidden', btn.dataset.tab !== 'users');
    document.getElementById('tabAudit').classList.toggle('hidden', btn.dataset.tab !== 'audit');
    document.getElementById('tabScan').classList.toggle('hidden', btn.dataset.tab !== 'scan');
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

async function load() {
  try {
    const user = getUser();
    ownConnectionName = (user && user.permissions && user.permissions.partnerAdminConnectionName) || '';
    partnerAdminTitle.textContent = ownConnectionName ? `Quản trị đối tác - Hệ thống ${ownConnectionName}` : 'Quản trị đối tác';

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
      return `
      <tr data-user-id="${u.userId}" data-username="${escapeHtml(u.username)}">
        <td data-label="Tên đăng nhập">${escapeHtml(u.username)}${sharedBadge}</td>
        <td data-label="Họ tên">${escapeHtml(u.fullName || '')}</td>
        <td data-label="Trạng thái">${stateLabel}</td>
        <td data-label="Hành động">${action}</td>
      </tr>`;
    })
    .join('');

  listBody.querySelectorAll('tr[data-user-id] .toggle-active-btn').forEach((btn) => {
    btn.addEventListener('click', () => toggleActive(btn.closest('tr')));
  });
  listBody.querySelectorAll('tr[data-user-id] .remove-connection-btn').forEach((btn) => {
    btn.addEventListener('click', () => removeOwnConnection(btn.closest('tr')));
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

async function removeOwnConnection(tr) {
  const userId = tr.dataset.userId;
  const username = tr.dataset.username;
  const label = ownConnectionName || 'của bạn';
  if (!confirm(`Gỡ quyền dùng hệ thống "${label}" khỏi tài khoản "${username}"? Tài khoản sẽ không còn hiện trong danh sách của bạn nữa (phần hệ thống khác của tài khoản này không bị ảnh hưởng).`)) return;

  const btn = tr.querySelector('.remove-connection-btn');
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
