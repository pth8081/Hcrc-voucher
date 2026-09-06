requireAuth();
renderTopbar('used-vouchers');

const fromDateInput = document.getElementById('fromDate');
const toDateInput = document.getElementById('toDate');
const reportBody = document.getElementById('reportBody');
const exportBtn = document.getElementById('exportBtn');

document.getElementById('loadBtn').addEventListener('click', loadReport);
exportBtn.addEventListener('click', exportExcel);
loadReport();

function buildQuery() {
  const params = new URLSearchParams();
  if (fromDateInput.value) params.set('fromDate', fromDateInput.value);
  if (toDateInput.value) params.set('toDate', toDateInput.value);
  return params.toString();
}

async function loadReport() {
  try {
    reportBody.innerHTML = '<tr><td colspan="8" class="text-muted">Dang tai...</td></tr>';
    const data = await apiFetch(`/reports/used-vouchers?${buildQuery()}`);
    render(data);
  } catch (err) {
    showToast(err.message);
  }
}

function render(rows) {
  if (!rows.length) {
    reportBody.innerHTML = '<tr><td colspan="8" class="text-muted">Khong co voucher nao trong khoang da chon</td></tr>';
    return;
  }

  reportBody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${fmtDate(row.createdDate)}</td>
        <td>${escapeHtml(row.transNum || '-')}</td>
        <td>${escapeHtml(row.voucherCode)}</td>
        <td>${escapeHtml(row.userName || '-')}</td>
        <td>${escapeHtml(row.companyName)}</td>
        <td>${escapeHtml(row.pointName)}</td>
        <td>${fmtMoney(row.valueAmt)}</td>
        <td>${row.synced ? 'Da dong bo' : '<span class="text-muted">Cho dong bo</span>'}</td>
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
