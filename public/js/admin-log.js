requireAuth();
renderTopbar('admin-log');

const notAdminNotice = document.getElementById('notAdminNotice');
const logCard = document.getElementById('logCard');
const auditBody = document.getElementById('auditBody');
const scanBody = document.getElementById('scanBody');

const ACTION_LABEL = {
  CREATE_USER: 'Tao tai khoan',
  UPDATE_PERMISSIONS: 'Doi quyen tinh nang',
  UPDATE_SCHEDULE: 'Doi lich hieu luc',
  UPDATE_REPORT_ACCESS: 'Doi nhom quyen bao cao',
  RESET_2FA: 'Go xac thuc hai yeu to',
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
          <td>${fmtDate(r.CreatedDate)}</td>
          <td>${escapeHtml(r.ActorUsername)}</td>
          <td>${escapeHtml(ACTION_LABEL[r.Action] || r.Action)}</td>
          <td>${escapeHtml(r.TargetUsername || '-')}</td>
          <td class="fs-13 text-muted">${escapeHtml(detailText(r.Detail))}</td>
        </tr>`
          )
          .join('')
      : '<tr><td colspan="5" class="text-muted">Chua co nhat ky nao</td></tr>';
  } catch (err) {
    notAdminNotice.classList.remove('hidden');
    logCard.classList.add('hidden');
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
          <td>${fmtDate(r.CreatedDate)}</td>
          <td>${escapeHtml(r.UserName || '-')}</td>
          <td>${escapeHtml(r.LocationsDetail || '-')}</td>
          <td>${escapeHtml(r.VoucherCode)}</td>
          <td>${escapeHtml(r.ScanMethod)}</td>
          <td>${escapeHtml(r.Action)}</td>
          <td>${escapeHtml(r.ResultStatus)}</td>
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

loadAudit();
loadScan();
