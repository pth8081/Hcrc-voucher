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
  reportBody.innerHTML = '<tr><td colspan="7" class="text-muted">Đang tải...</td></tr>';
  try {
    const data = await apiFetch(`/reports/summary?${buildQuery()}`);
    render(data);
  } catch (err) {
    showToast(err.message);
    reportBody.innerHTML = `<tr><td colspan="7" class="text-danger">Lỗi tải dữ liệu: ${escapeHtml(err.message)}. Vui lòng thử lại.</td></tr>`;
  }
}

function render(data) {
  if (data.unassignedLocation) {
    reportBody.innerHTML = '<tr><td colspan="7" class="text-danger">Tài khoản của bạn chưa được gán địa điểm/nhóm quyền xem báo cáo - vui lòng liên hệ quản trị viên.</td></tr>';
    return;
  }
  if (!data.companies.length) {
    reportBody.innerHTML = '<tr><td colspan="7" class="text-muted">Không có giao dịch trong khoảng ngày đã chọn</td></tr>';
    return;
  }

  const rowsHtml = [];

  data.companies.forEach((company) => {
    rowsHtml.push(`
      <tr class="company-row">
        <td data-label="Công ty">${escapeHtml(company.companyName)}</td>
        <td></td><td></td><td></td><td></td>
        <td data-label="Số voucher">${company.count}</td>
        <td data-label="Mệnh giá">${fmtMoney(company.amount)}</td>
      </tr>`);

    company.points.forEach((point) => {
      rowsHtml.push(`
        <tr class="point-row">
          <td data-label="Điểm tiêu">${escapeHtml(point.pointName)}</td>
          <td></td><td></td><td></td><td></td>
          <td data-label="Số voucher">${point.count}</td>
          <td data-label="Mệnh giá">${fmtMoney(point.amount)}</td>
        </tr>`);

      point.rows.forEach((row) => {
        rowsHtml.push(`
          <tr class="detail-row">
            <td></td>
            <td data-label="Ngày tiêu">${fmtDate(row.createdDate)}</td>
            <td data-label="Người tiêu">${escapeHtml(row.userName || '-')}</td>
            <td data-label="Mã giao dịch">${escapeHtml(row.transNum || '-')}</td>
            <td data-label="Mã voucher">${escapeHtml(row.voucherCode)}${row.synced ? '' : ' <span class="text-muted">(chờ đồng bộ)</span>'}</td>
            <td></td>
            <td data-label="Mệnh giá">${fmtMoney(row.valueAmt)}</td>
          </tr>`);
      });
    });
  });

  rowsHtml.push(`
    <tr class="grand-total-row">
      <td data-label="Tổng">TỔNG TOÀN BỘ CÔNG TY</td>
      <td></td><td></td><td></td><td></td>
      <td data-label="Số voucher">${data.grandTotal.count}</td>
      <td data-label="Mệnh giá">${fmtMoney(data.grandTotal.amount)}</td>
    </tr>`);

  reportBody.innerHTML = rowsHtml.join('');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
