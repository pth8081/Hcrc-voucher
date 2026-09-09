requireAuth();
renderTopbar('report');

const reportDate = document.getElementById('reportDate');
const summaryBody = document.getElementById('summaryBody');
const detailBody = document.getElementById('detailBody');

reportDate.value = new Date().toISOString().slice(0, 10);
document.getElementById('loadBtn').addEventListener('click', loadReport);
loadReport();

async function loadReport() {
  summaryBody.innerHTML = '<tr><td colspan="3" class="text-muted">Dang tai...</td></tr>';
  detailBody.innerHTML = '<tr><td colspan="6" class="text-muted">Dang tai...</td></tr>';
  try {
    const data = await apiFetch(`/reports/daily?date=${encodeURIComponent(reportDate.value)}`);
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
    summaryBody.innerHTML = '<tr><td colspan="3" class="text-muted">Khong co giao dich trong ngay</td></tr>';
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
    detailBody.innerHTML = '<tr><td colspan="6" class="text-muted">Khong co giao dich trong ngay</td></tr>';
    return;
  }
  detailBody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td data-label="Gio">${fmtDate(r.Created_Date)}</td>
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
