requireAuth();
renderTopbar('used-vouchers');

const fromDateInput = document.getElementById('fromDate');
const toDateInput = document.getElementById('toDate');
const filterInvoiceInput = document.getElementById('filterInvoice');
const reportBody = document.getElementById('reportBody');
const exportBtn = document.getElementById('exportBtn');

// v3.84: mac dinh "hom nay -> hom nay" (dong bo voi 2 bao cao con lai) - truoc day de trong ca 2
// o (mac dinh xem TOAN BO lich su) theo yeu cau nguoi dung. Van xoa trong duoc 2 o nay de xem lai
// toan bo lich su nhu cu, chi doi GIA TRI MAC DINH luc vao trang.
const today = new Date().toISOString().slice(0, 10);
fromDateInput.value = today;
toDateInput.value = today;

document.getElementById('loadBtn').addEventListener('click', loadReport);
exportBtn.addEventListener('click', exportExcel);
initReportFilters();
loadReport();

function buildQuery() {
  const params = new URLSearchParams();
  if (fromDateInput.value) params.set('fromDate', fromDateInput.value);
  if (toDateInput.value) params.set('toDate', toDateInput.value);
  if (filterInvoiceInput.value.trim()) params.set('invoiceNumber', filterInvoiceInput.value.trim());
  const filters = getReportFilterParams();
  Object.entries(filters).forEach(([key, value]) => params.set(key, value));
  return params.toString();
}

async function loadReport() {
  try {
    reportBody.innerHTML = '<tr><td colspan="10" class="text-muted">Đang tải...</td></tr>';
    const data = await apiFetch(`/reports/used-vouchers?${buildQuery()}`);
    render(data.rows, data.unassignedLocation);
    if (data.truncated) {
      showToast(`Danh sách đang quá nhiều, chỉ hiện ${data.rows.length.toLocaleString('vi-VN')} dòng đầu. Thu hẹp khoảng ngày hoặc dùng "Xuất Excel" để xem đầy đủ.`);
    }
  } catch (err) {
    showToast(err.message);
    reportBody.innerHTML = `<tr><td colspan="10" class="text-danger">Lỗi tải dữ liệu: ${escapeHtml(err.message)}. Vui lòng thử lại.</td></tr>`;
  }
}

function render(rows, unassignedLocation) {
  if (unassignedLocation) {
    reportBody.innerHTML = '<tr><td colspan="10" class="text-danger">Tài khoản của bạn chưa được gán địa điểm/nhóm quyền xem báo cáo - vui lòng liên hệ quản trị viên.</td></tr>';
    return;
  }
  if (!rows.length) {
    reportBody.innerHTML = '<tr><td colspan="10" class="text-muted">Không có voucher nào trong khoảng đã chọn</td></tr>';
    return;
  }

  reportBody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td data-label="Ngày tiêu">${fmtDate(row.createdDate)}</td>
        <td data-label="Mã giao dịch">${escapeHtml(row.transNum || '-')}</td>
        <td data-label="Mã voucher">${escapeHtml(row.voucherCode)}</td>
        <td data-label="Người tiêu">${escapeHtml(row.userName || '-')}</td>
        <td data-label="Công ty">${escapeHtml(row.companyName)}</td>
        <td data-label="Điểm tiêu">${escapeHtml(row.pointName)}</td>
        <td data-label="Hệ thống">${escapeHtml(row.connectionName || '-')}</td>
        <td data-label="Số tiền">${fmtMoney(row.valueAmt)}</td>
        <td data-label="Số hóa đơn">${row.invoiceNumber ? escapeHtml(row.invoiceNumber) : '<span class="text-muted">-</span>'}</td>
        <td data-label="Đồng bộ">${row.synced ? 'Đã đồng bộ' : '<span class="text-muted">Chờ đồng bộ</span>'}</td>
      </tr>`
    )
    .join('');
}

/**
 * Xuat Excel PHAI di qua fetch() kem header Authorization (khong dung the <a href> tro thang
 * toi API, vi request se khong mang theo JWT va bi tu choi 401) - nhan ve blob roi kich hoat
 * tai xuong qua 1 the <a> tam thoi.
 */
async function exportExcel() {
  if (!fromDateInput.value && !toDateInput.value) {
    showToast('Vui lòng chọn ít nhất 1 mốc ngày (từ ngày hoặc đến ngày) trước khi xuất Excel');
    return;
  }
  exportBtn.disabled = true;
  try {
    const res = await fetch(`/api/reports/used-vouchers/export?${buildQuery()}`, {
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
    a.download = `voucher-da-su-dung_${fromDateInput.value || 'toanbo'}_${toDateInput.value || 'toanbo'}.xlsx`;
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
