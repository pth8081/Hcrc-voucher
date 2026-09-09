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
        <td data-label="Cong ty">${escapeHtml(company.companyName)}</td>
        <td></td><td></td><td></td><td></td>
        <td data-label="So voucher">${company.count}</td>
        <td data-label="Menh gia">${fmtMoney(company.amount)}</td>
      </tr>`);

    company.points.forEach((point) => {
      rowsHtml.push(`
        <tr class="point-row">
          <td data-label="Diem tieu">${escapeHtml(point.pointName)}</td>
          <td></td><td></td><td></td><td></td>
          <td data-label="So voucher">${point.count}</td>
          <td data-label="Menh gia">${fmtMoney(point.amount)}</td>
        </tr>`);

      point.rows.forEach((row) => {
        rowsHtml.push(`
          <tr class="detail-row">
            <td></td>
            <td data-label="Ngay tieu">${fmtDate(row.createdDate)}</td>
            <td data-label="Nguoi tieu">${escapeHtml(row.userName || '-')}</td>
            <td data-label="Ma giao dich">${escapeHtml(row.transNum || '-')}</td>
            <td data-label="Ma voucher">${escapeHtml(row.voucherCode)}${row.synced ? '' : ' <span class="text-muted">(cho dong bo)</span>'}</td>
            <td></td>
            <td data-label="Menh gia">${fmtMoney(row.valueAmt)}</td>
          </tr>`);
      });
    });
  });

  rowsHtml.push(`
    <tr class="grand-total-row">
      <td data-label="Tong">TONG TOAN BO CONG TY</td>
      <td></td><td></td><td></td><td></td>
      <td data-label="So voucher">${data.grandTotal.count}</td>
      <td data-label="Menh gia">${fmtMoney(data.grandTotal.amount)}</td>
    </tr>`);

  reportBody.innerHTML = rowsHtml.join('');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
