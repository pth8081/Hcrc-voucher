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
  CREATE_USER: 'Tao tai khoan',
  UPDATE_USER_LOCATION: 'Doi diem tieu tai khoan',
  UPDATE_USER_PROFILE: 'Sua ho ten/dat lai mat khau',
  DELETE_USER: 'Xoa tai khoan',
  RESTORE_USER: 'Khoi phuc tai khoan',
  UPDATE_PERMISSIONS: 'Doi quyen tinh nang',
  UPDATE_SCHEDULE: 'Doi lich hieu luc',
  UPDATE_REPORT_ACCESS: 'Doi nhom quyen bao cao',
  RESET_2FA: 'Go xac thuc hai yeu to',
  CREATE_ACCESS_GROUP: 'Tao nhom quyen bao cao',
  UPDATE_ACCESS_GROUP: 'Sua nhom quyen bao cao',
  CREATE_REDEMPTION_UNIT: 'Tao don vi thu hoi',
  UPDATE_REDEMPTION_UNIT: 'Sua don vi thu hoi',
  CREATE_COMPANY: 'Tao cong ty',
  UPDATE_COMPANY: 'Sua cong ty',
  CREATE_API_CONNECTION: 'Tao ket noi API',
  UPDATE_API_CONNECTION: 'Sua ket noi API',
  ACTIVATE_API_CONNECTION: 'Kich hoat ket noi API',
  DELETE_API_CONNECTION: 'Xoa ket noi API',
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
          <td data-label="Thoi gian">${fmtDate(r.CreatedDate)}</td>
          <td data-label="Nguoi thuc hien">${escapeHtml(r.ActorUsername)}</td>
          <td data-label="Hanh dong">${escapeHtml(ACTION_LABEL[r.Action] || r.Action)}</td>
          <td data-label="Doi tuong">${escapeHtml(r.TargetUsername || '-')}</td>
          <td class="fs-13 text-muted" data-label="Chi tiet">${escapeHtml(detailText(r.Detail))}</td>
        </tr>`
          )
          .join('')
      : '<tr><td colspan="5" class="text-muted">Chua co nhat ky nao</td></tr>';
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
    scanBody.innerHTML = '<tr><td colspan="7" class="text-muted">Dang tai...</td></tr>';
    const rows = await apiFetch(`/admin/scan-log?${params.toString()}`);
    scanBody.innerHTML = rows.length
      ? rows
          .map(
            (r) => `
        <tr>
          <td data-label="Thoi gian">${fmtDate(r.CreatedDate)}</td>
          <td data-label="Nguoi quet">${escapeHtml(r.UserName || '-')}</td>
          <td data-label="Dia diem">${escapeHtml(r.LocationsDetail || '-')}</td>
          <td data-label="Ma voucher">${escapeHtml(r.VoucherCode)}</td>
          <td data-label="Cach quet">${escapeHtml(r.ScanMethod)}</td>
          <td data-label="Hanh dong">${escapeHtml(r.Action)}</td>
          <td data-label="Ket qua">${escapeHtml(r.ResultStatus)}</td>
        </tr>`
          )
          .join('')
      : '<tr><td colspan="7" class="text-muted">Khong co du lieu trong khoang da chon</td></tr>';
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
