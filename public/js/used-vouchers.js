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
    render(data.rows, data.unassignedLocation);
    if (data.truncated) {
      showToast(`Danh sach dang qua nhieu, chi hien ${data.rows.length.toLocaleString('vi-VN')} dong dau. Thu hep khoang ngay hoac dung "Xuat Excel" de xem day du.`);
    }
  } catch (err) {
    showToast(err.message);
    reportBody.innerHTML = `<tr><td colspan="8" class="text-danger">Loi tai du lieu: ${escapeHtml(err.message)}. Vui long thu lai.</td></tr>`;
  }
}

function render(rows, unassignedLocation) {
  if (unassignedLocation) {
    reportBody.innerHTML = '<tr><td colspan="8" class="text-danger">Tai khoan cua ban chua duoc gan dia diem/nhom quyen xem bao cao - vui long lien he quan tri vien.</td></tr>';
    return;
  }
  if (!rows.length) {
    reportBody.innerHTML = '<tr><td colspan="8" class="text-muted">Khong co voucher nao trong khoang da chon</td></tr>';
    return;
  }

  reportBody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td data-label="Ngay tieu">${fmtDate(row.createdDate)}</td>
        <td data-label="Ma giao dich">${escapeHtml(row.transNum || '-')}</td>
        <td data-label="Ma voucher">${escapeHtml(row.voucherCode)}</td>
        <td data-label="Nguoi tieu">${escapeHtml(row.userName || '-')}</td>
        <td data-label="Cong ty">${escapeHtml(row.companyName)}</td>
        <td data-label="Diem tieu">${escapeHtml(row.pointName)}</td>
        <td data-label="So tien">${fmtMoney(row.valueAmt)}</td>
        <td data-label="Dong bo">${row.synced ? 'Da dong bo' : '<span class="text-muted">Cho dong bo</span>'}</td>
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
    showToast('Vui long chon it nhat 1 moc ngay (tu ngay hoac den ngay) truoc khi xuat Excel');
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
