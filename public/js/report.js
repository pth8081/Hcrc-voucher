requireAuth();
renderTopbar('report');

const fromDateInput = document.getElementById('fromDate');
const toDateInput = document.getElementById('toDate');
const summaryBody = document.getElementById('summaryBody');
const detailBody = document.getElementById('detailBody');

const today = new Date().toISOString().slice(0, 10);
fromDateInput.value = today;
toDateInput.value = today;
document.getElementById('loadBtn').addEventListener('click', loadReport);
initReportFilters();
loadReport();

function buildQuery() {
  const params = new URLSearchParams();
  params.set('fromDate', fromDateInput.value);
  params.set('toDate', toDateInput.value);
  const filters = getReportFilterParams();
  Object.entries(filters).forEach(([key, value]) => params.set(key, value));
  return params.toString();
}

async function loadReport() {
  summaryBody.innerHTML = '<tr><td colspan="3" class="text-muted">Dang tai...</td></tr>';
  detailBody.innerHTML = '<tr><td colspan="6" class="text-muted">Dang tai...</td></tr>';
  try {
    const data = await apiFetch(`/reports/daily?${buildQuery()}`);
    renderSummary(data.summary, data.unassignedLocation);
    renderDetails(data.details, data.unassignedLocation);
  } catch (err) {
    showToast(err.message);
    const errHtml = `<td colspan="COLSPAN" class="text-danger">Loi tai du lieu: ${escapeHtml(err.message)}. Vui long thu lai.</td>`;
    summaryBody.innerHTML = `<tr>${errHtml.replace('COLSPAN', '3')}</tr>`;
    detailBody.innerHTML = `<tr>${errHtml.replace('COLSPAN', '6')}</tr>`;
  }
}

function renderSummary(rows, unassignedLocation) {
  if (unassignedLocation) {
    summaryBody.innerHTML = '<tr><td colspan="3" class="text-danger">Tai khoan cua ban chua duoc gan dia diem/nhom quyen xem bao cao - vui long lien he quan tri vien.</td></tr>';
    return;
  }
  if (!rows.length) {
    summaryBody.innerHTML = '<tr><td colspan="3" class="text-muted">Khong co giao dich trong khoang ngay da chon</td></tr>';
    return;
  }
  summaryBody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td data-label="Dia diem">${escapeHtml(r.Location_DetailName || r.Locations_Detail)}</td>
        <td data-label="So luong">${r.VoucherCount}</td>
        <td data-label="Tong tien">${fmtMoney(r.TotalAmount)}</td>
      </tr>`
    )
    .join('');
}

function renderDetails(rows, unassignedLocation) {
  if (unassignedLocation) {
    detailBody.innerHTML = '<tr><td colspan="6" class="text-danger">Tai khoan cua ban chua duoc gan dia diem/nhom quyen xem bao cao - vui long lien he quan tri vien.</td></tr>';
    return;
  }
  if (!rows.length) {
    detailBody.innerHTML = '<tr><td colspan="6" class="text-muted">Khong co giao dich trong khoang ngay da chon</td></tr>';
    return;
  }
  detailBody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td data-label="Ngay gio">${fmtDate(r.Created_Date)}</td>
        <td data-label="Ma giao dich">${escapeHtml(r.TRANS_NUM || '-')}</td>
        <td data-label="Ma voucher">${escapeHtml(r.Voucher_Code)}</td>
        <td data-label="Nguoi thu hoi">${escapeHtml(r.User_Name || '-')}</td>
        <td data-label="Dia diem">${escapeHtml(r.Location_DetailName || r.Locations_Detail)}</td>
        <td data-label="Menh gia">${fmtMoney(r.VALUE_AMT)}</td>
      </tr>`
    )
    .join('');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
