requireAuth();
renderTopbar('admin-log');

const notAdminNotice = document.getElementById('notAdminNotice');
const logCard = document.getElementById('logCard');
const auditBody = document.getElementById('auditBody');
const scanBody = document.getElementById('scanBody');

// L5: truoc day thieu nhieu ma hanh dong (cac controller khac da ghi log tu lau nhung chua bao
// gio duoc them vao day) - Nhat ky quan tri hien thang ma tieng Anh vd "UPDATE_USER_LOCATION"
// thay vi nhan tieng Viet de nguoi xem hieu ngay.
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
  CREATE_ACCESS_GROUP: 'Tạo nhóm quyền báo cáo',
  UPDATE_ACCESS_GROUP: 'Sửa nhóm quyền báo cáo',
  CREATE_REDEMPTION_UNIT: 'Tạo đơn vị thu hồi',
  UPDATE_REDEMPTION_UNIT: 'Sửa đơn vị thu hồi',
  CREATE_COMPANY: 'Tạo công ty',
  UPDATE_COMPANY: 'Sửa công ty',
  CREATE_API_CONNECTION: 'Tạo kết nối API',
  UPDATE_API_CONNECTION: 'Sửa kết nối API',
  ACTIVATE_API_CONNECTION: 'Kích hoạt kết nối API',
  DELETE_API_CONNECTION: 'Xóa kết nối API',
  UPDATE_USER_VOUCHER_SYSTEMS: 'Đổi hệ thống voucher được dùng',
};

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tabAudit').classList.toggle('hidden', btn.dataset.tab !== 'audit');
    document.getElementById('tabScan').classList.toggle('hidden', btn.dataset.tab !== 'scan');
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

async function loadAudit() {
  try {
    const rows = await apiFetch('/admin/audit-log');
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
    return true;
  } catch (err) {
    notAdminNotice.classList.remove('hidden');
    logCard.classList.add('hidden');
    return false;
  }
}

async function loadScan() {
  const fromDate = document.getElementById('scanFromDate').value;
  const toDate = document.getElementById('scanToDate').value;
  const params = new URLSearchParams();
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate) params.set('toDate', toDate);

  try {
    scanBody.innerHTML = '<tr><td colspan="7" class="text-muted">Đang tải...</td></tr>';
    const rows = await apiFetch(`/admin/scan-log?${params.toString()}`);
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

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

document.getElementById('loadScanBtn').addEventListener('click', loadScan);

// Chi tai tab "Hoat dong quet" NEU da xac nhan la admin (loadAudit thanh cong) - tranh goi them
// 1 API se 403 va bao thua 1 toast trung voi khoi "chi admin" da hien tu loadAudit.
(async function init() {
  const isAdmin = await loadAudit();
  if (isAdmin) loadScan();
})();
