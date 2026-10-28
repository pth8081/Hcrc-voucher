requireAuth();
renderTopbar('report');

const fromDateInput = document.getElementById('fromDate');
const toDateInput = document.getElementById('toDate');
const summaryBody = document.getElementById('summaryBody');
const detailBody = document.getElementById('detailBody');
const exportBtn = document.getElementById('exportBtn');

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
  summaryBody.innerHTML = '<tr><td colspan="5" class="text-muted">Đang tải...</td></tr>';
  detailBody.innerHTML = '<tr><td colspan="10" class="text-muted">Đang tải...</td></tr>';
  try {
    const data = await apiFetch(`/reports/daily?${buildQuery()}`);
    renderSummary(data.summary, data.unassignedLocation);
    renderDetails(data.details, data.unassignedLocation);
  } catch (err) {
    showToast(err.message);
    const errHtml = `<td colspan="COLSPAN" class="text-danger">Lỗi tải dữ liệu: ${escapeHtml(err.message)}. Vui lòng thử lại.</td>`;
    summaryBody.innerHTML = `<tr>${errHtml.replace('COLSPAN', '5')}</tr>`;
    detailBody.innerHTML = `<tr>${errHtml.replace('COLSPAN', '10')}</tr>`;
  }
}

function renderSummary(rows, unassignedLocation) {
  if (unassignedLocation) {
    summaryBody.innerHTML = '<tr><td colspan="5" class="text-danger">Tài khoản của bạn chưa được gán địa điểm/nhóm quyền xem báo cáo - vui lòng liên hệ quản trị viên.</td></tr>';
    return;
  }
  if (!rows.length) {
    summaryBody.innerHTML = '<tr><td colspan="5" class="text-muted">Không có giao dịch trong khoảng ngày đã chọn</td></tr>';
    return;
  }
  summaryBody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td data-label="Công ty">${escapeHtml(r.CompanyName || '-')}</td>
        <td data-label="Địa điểm">${escapeHtml(r.Location_DetailName || r.Locations_Detail)}</td>
        <td data-label="Điểm tiêu">${escapeHtml(r.UnitName || r.Location_DetailName || r.Locations_Detail)}</td>
        <td data-label="Số lượng">${r.VoucherCount}</td>
        <td data-label="Tổng tiền">${fmtMoney(r.TotalAmount)}</td>
      </tr>`
    )
    .join('');
}

function renderDetails(rows, unassignedLocation) {
  if (unassignedLocation) {
    detailBody.innerHTML = '<tr><td colspan="10" class="text-danger">Tài khoản của bạn chưa được gán địa điểm/nhóm quyền xem báo cáo - vui lòng liên hệ quản trị viên.</td></tr>';
    return;
  }
  if (!rows.length) {
    detailBody.innerHTML = '<tr><td colspan="10" class="text-muted">Không có giao dịch trong khoảng ngày đã chọn</td></tr>';
    return;
  }
  detailBody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td data-label="Ngày giờ">${fmtDate(r.Created_Date)}</td>
        <td data-label="Mã giao dịch">${escapeHtml(r.TRANS_NUM || '-')}</td>
        <td data-label="Mã voucher">${escapeHtml(r.Voucher_Code)}</td>
        <td data-label="Người thu hồi">${escapeHtml(r.User_Name || '-')}</td>
        <td data-label="Công ty">${escapeHtml(r.CompanyName || '-')}</td>
        <td data-label="Địa điểm">${escapeHtml(r.Location_DetailName || r.Locations_Detail)}</td>
        <td data-label="Điểm tiêu">${escapeHtml(r.UnitName || r.Location_DetailName || r.Locations_Detail)}</td>
        <td data-label="Hệ thống">${escapeHtml(r.ConnectionName || '-')}</td>
        <td data-label="Mệnh giá">${fmtMoney(r.VALUE_AMT)}</td>
        <td data-label="Số hóa đơn">${r.InvoiceNumber ? escapeHtml(r.InvoiceNumber) : '<span class="text-muted">-</span>'}</td>
      </tr>`
    )
    .join('');
}

/**
 * Xuat Excel PHAI di qua fetch() kem header Authorization (xem used-vouchers.js#exportExcel) -
 * khac voi man hinh do, bao cao nay LUON co san fromDate/toDate (mac dinh hom nay) nen khong can
 * kiem tra bat buoc chon ngay truoc khi xuat.
 */
async function exportExcel() {
  exportBtn.disabled = true;
  try {
    const res = await fetch(`/api/reports/daily/export?${buildQuery()}`, {
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
    a.download = `bao-cao-doi-soat_${fromDateInput.value}_${toDateInput.value}.xlsx`;
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
