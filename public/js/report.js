requireAuth();

document.getElementById('logoutLink').addEventListener('click', (e) => {
  e.preventDefault();
  clearSession();
  window.location.href = '/login.html';
});

const reportDate = document.getElementById('reportDate');
const summaryBody = document.getElementById('summaryBody');
const detailBody = document.getElementById('detailBody');

reportDate.value = new Date().toISOString().slice(0, 10);
document.getElementById('loadBtn').addEventListener('click', loadReport);
loadReport();

async function loadReport() {
  try {
    const data = await apiFetch(`/reports/daily?date=${encodeURIComponent(reportDate.value)}`);
    renderSummary(data.summary);
    renderDetails(data.details);
  } catch (err) {
    showToast(err.message);
  }
}

function renderSummary(rows) {
  if (!rows.length) {
    summaryBody.innerHTML = '<tr><td colspan="3" style="color:#999;">Khong co giao dich trong ngay</td></tr>';
    return;
  }
  summaryBody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.Location_DetailName || r.Locations_Detail)}</td>
        <td>${r.VoucherCount}</td>
        <td>${fmtMoney(r.TotalAmount)}</td>
      </tr>`
    )
    .join('');
}

function renderDetails(rows) {
  if (!rows.length) {
    detailBody.innerHTML = '<tr><td colspan="6" style="color:#999;">Khong co giao dich trong ngay</td></tr>';
    return;
  }
  detailBody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td>${fmtDate(r.Created_Date)}</td>
        <td>${escapeHtml(r.TRANS_NUM || '-')}</td>
        <td>${escapeHtml(r.Voucher_Code)}</td>
        <td>${escapeHtml(r.User_Name || '-')}</td>
        <td>${escapeHtml(r.Location_DetailName || r.Locations_Detail)}</td>
        <td>${fmtMoney(r.VALUE_AMT)}</td>
      </tr>`
    )
    .join('');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
