requireAuth();
renderTopbar('summary-report');

const fromDateInput = document.getElementById('fromDate');
const toDateInput = document.getElementById('toDate');
const reportBody = document.getElementById('reportBody');
const exportBtn = document.getElementById('exportBtn');

// v3.84: mac dinh "hom nay -> hom nay" (dong bo voi 2 bao cao con lai) - truoc day la "dau thang
// -> hom nay", theo yeu cau nguoi dung.
const today = new Date().toISOString().slice(0, 10);
fromDateInput.value = today;
toDateInput.value = today;

document.getElementById('loadBtn').addEventListener('click', loadReport);
exportBtn.addEventListener('click', exportExcel);
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
  reportBody.innerHTML = '<tr><td colspan="10" class="text-muted">Đang tải...</td></tr>';
  try {
    const data = await apiFetch(`/reports/summary?${buildQuery()}`);
    render(data);
  } catch (err) {
    showToast(err.message);
    reportBody.innerHTML = `<tr><td colspan="10" class="text-danger">Lỗi tải dữ liệu: ${escapeHtml(err.message)}. Vui lòng thử lại.</td></tr>`;
  }
}

function render(data) {
  if (data.unassignedLocation) {
    reportBody.innerHTML = '<tr><td colspan="10" class="text-danger">Tài khoản của bạn chưa được gán địa điểm/nhóm quyền xem báo cáo - vui lòng liên hệ quản trị viên.</td></tr>';
    return;
  }
  if (!data.companies.length) {
    reportBody.innerHTML = '<tr><td colspan="10" class="text-muted">Không có giao dịch trong khoảng ngày đã chọn</td></tr>';
    return;
  }

  const rowsHtml = [];

  data.companies.forEach((company) => {
    rowsHtml.push(`
      <tr class="company-row">
        <td data-label="Công ty">${escapeHtml(company.companyName)}</td>
        <td></td><td></td><td></td><td></td><td></td><td></td>
        <td data-label="Số voucher">${company.count}</td>
        <td data-label="Mệnh giá">${fmtMoney(company.amount)}</td>
        <td></td>
      </tr>`);

    company.points.forEach((point) => {
      rowsHtml.push(`
        <tr class="point-row">
          <td data-label="Điểm tiêu">${escapeHtml(point.pointName)}</td>
          <td data-label="Địa điểm">${escapeHtml(point.locationName)}</td>
          <td></td><td></td><td></td><td></td><td></td>
          <td data-label="Số voucher">${point.count}</td>
          <td data-label="Mệnh giá">${fmtMoney(point.amount)}</td>
          <td></td>
        </tr>`);

      point.rows.forEach((row) => {
        rowsHtml.push(`
          <tr class="detail-row">
            <td></td>
            <td></td>
            <td data-label="Ngày tiêu">${fmtDate(row.createdDate)}</td>
            <td data-label="Người tiêu">${escapeHtml(row.userName || '-')}</td>
            <td data-label="Mã giao dịch">${escapeHtml(row.transNum || '-')}</td>
            <td data-label="Mã voucher">${escapeHtml(row.voucherCode)}${row.synced ? '' : ' <span class="text-muted">(chờ đồng bộ)</span>'}</td>
            <td data-label="Thời hạn">${fmtDate(row.expiryDate)}</td>
            <td></td>
            <td data-label="Mệnh giá">${fmtMoney(row.valueAmt)}</td>
            <td data-label="Số hóa đơn">${row.invoiceNumber ? escapeHtml(row.invoiceNumber) : '<span class="text-muted">-</span>'}</td>
          </tr>`);
      });
    });
  });

  rowsHtml.push(`
    <tr class="grand-total-row">
      <td data-label="Tổng">TỔNG TOÀN BỘ CÔNG TY</td>
      <td></td><td></td><td></td><td></td><td></td><td></td>
      <td data-label="Số voucher">${data.grandTotal.count}</td>
      <td data-label="Mệnh giá">${fmtMoney(data.grandTotal.amount)}</td>
      <td></td>
    </tr>`);

  reportBody.innerHTML = rowsHtml.join('');
}

/** Xuat Excel PHAI di qua fetch() kem header Authorization (xem used-vouchers.js#exportExcel). */
async function exportExcel() {
  exportBtn.disabled = true;
  try {
    const res = await fetch(`/api/reports/summary/export?${buildQuery()}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `Loi xuat Excel (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-tong-hop_${fromDateInput.value}_${toDateInput.value}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast(err.message);
  } finally {
    exportBtn.disabled = false;
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
