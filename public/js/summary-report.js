requireAuth();
renderTopbar('summary-report');

const fromDateInput = document.getElementById('fromDate');
const toDateInput = document.getElementById('toDate');
const reportBody = document.getElementById('reportBody');

const today = new Date();
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
fromDateInput.value = firstOfMonth.toISOString().slice(0, 10);
toDateInput.value = today.toISOString().slice(0, 10);

document.getElementById('loadBtn').addEventListener('click', loadReport);
loadReport();

async function loadReport() {
  reportBody.innerHTML = '<tr><td colspan="7" class="text-muted">Dang tai...</td></tr>';
  try {
    const data = await apiFetch(
      `/reports/summary?fromDate=${encodeURIComponent(fromDateInput.value)}&toDate=${encodeURIComponent(toDateInput.value)}`
    );
    render(data);
  } catch (err) {
    showToast(err.message);
    reportBody.innerHTML = `<tr><td colspan="7" class="text-danger">Loi tai du lieu: ${escapeHtml(err.message)}. Vui long thu lai.</td></tr>`;
  }
}

function render(data) {
  if (data.unassignedLocation) {
    reportBody.innerHTML = '<tr><td colspan="7" class="text-danger">Tai khoan cua ban chua duoc gan dia diem/nhom quyen xem bao cao - vui long lien he quan tri vien.</td></tr>';
    return;
  }
  if (!data.companies.length) {
    reportBody.innerHTML = '<tr><td colspan="7" class="text-muted">Khong co giao dich trong khoang ngay da chon</td></tr>';
    return;
  }

  const rowsHtml = [];

  data.companies.forEach((company) => {
    rowsHtml.push(`
      <tr class="company-row">
        <td>${escapeHtml(company.companyName)}</td>
        <td></td><td></td><td></td><td></td>
        <td>${company.count}</td>
        <td>${fmtMoney(company.amount)}</td>
      </tr>`);

    company.points.forEach((point) => {
      rowsHtml.push(`
        <tr class="point-row">
          <td>${escapeHtml(point.pointName)}</td>
          <td></td><td></td><td></td><td></td>
          <td>${point.count}</td>
          <td>${fmtMoney(point.amount)}</td>
        </tr>`);

      point.rows.forEach((row) => {
        rowsHtml.push(`
          <tr class="detail-row">
            <td></td>
            <td>${fmtDate(row.createdDate)}</td>
            <td>${escapeHtml(row.userName || '-')}</td>
            <td>${escapeHtml(row.transNum || '-')}</td>
            <td>${escapeHtml(row.voucherCode)}${row.synced ? '' : ' <span class="text-muted">(cho dong bo)</span>'}</td>
            <td></td>
            <td>${fmtMoney(row.valueAmt)}</td>
          </tr>`);
      });
    });
  });

  rowsHtml.push(`
    <tr class="grand-total-row">
      <td>TONG TOAN BO CONG TY</td>
      <td></td><td></td><td></td><td></td>
      <td>${data.grandTotal.count}</td>
      <td>${fmtMoney(data.grandTotal.amount)}</td>
    </tr>`);

  reportBody.innerHTML = rowsHtml.join('');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
