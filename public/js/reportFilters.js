/**
 * Dung chung cho 3 man hinh bao cao (doi soat, tong hop, danh sach voucher da su dung) - nap gia
 * tri cho 4 o loc Cong ty thu / Diem thu hoi / Tai khoan thu hoi / He thong voucher va xu ly
 * cascading Cong ty -> Diem thu hoi (chon cong ty truoc se loc lai danh sach diem thu hoi tuong
 * ung, giong cach units.js lam voi form tao Diem tieu). Yeu cau san cac the <select> trong trang
 * voi id: filterCompany, filterUnit, filterUser, filterSystem (filterSystem la TUY CHON - bo
 * qua gon neu trang khong co o nay).
 */
async function initReportFilters(onChange) {
  const companySelect = document.getElementById('filterCompany');
  const unitSelect = document.getElementById('filterUnit');
  const userSelect = document.getElementById('filterUser');
  const systemSelect = document.getElementById('filterSystem');
  const systemField = document.getElementById('filterSystemField');
  if (!companySelect || !unitSelect || !userSelect) return;

  async function loadUnits(companyId) {
    const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    const units = await apiFetch(`/reports/filters/redemption-units${query}`);
    const current = unitSelect.value;
    unitSelect.innerHTML =
      '<option value="">Tất cả điểm thu hồi</option>' +
      units.map((u) => `<option value="${u.Id}">${escapeHtmlFilter(u.PartnerName || '(chưa có tên)')}</option>`).join('');
    if (current && units.some((u) => String(u.Id) === current)) unitSelect.value = current;
  }

  try {
    const [companies, redeemers] = await Promise.all([
      apiFetch('/reports/filters/companies'),
      apiFetch('/reports/filters/redeemers'),
    ]);
    companySelect.innerHTML =
      '<option value="">Tất cả công ty</option>' +
      companies.map((c) => `<option value="${c.Id}">${escapeHtmlFilter(c.CompanyName)}</option>`).join('');
    userSelect.innerHTML =
      '<option value="">Tất cả tài khoản</option>' +
      redeemers.map((r) => `<option value="${r.userId}">${escapeHtmlFilter(r.userName || '(không rõ)')}</option>`).join('');
    await loadUnits(null);
  } catch (err) {
    showToast('Không tải được danh sách lọc: ' + err.message);
  }

  // He thong voucher: tai khoan bi gioi han CHI 1 he thong (vd tai khoan doi soat rieng cho
  // Fuji) khong can/khong nen thay o chon nay - server da TU DONG ap dung dung gioi han do du
  // khong chon gi (xem report.controller.js#resolveConnectionFilter). Chi hien o chon khi tai
  // khoan nay duoc xem TU 2 he thong tro len, giong cach lam o man hinh Quet voucher.
  if (systemSelect && systemField) {
    try {
      const systems = await apiFetch('/reports/filters/systems');
      if (systems.length > 1) {
        systemField.classList.remove('hidden');
        systemSelect.innerHTML =
          '<option value="">Tất cả hệ thống</option>' +
          systems.map((s) => `<option value="${s.id}">${escapeHtmlFilter(s.name)}</option>`).join('');
        systemSelect.addEventListener('change', () => onChange && onChange());
      }
    } catch (err) {
      showToast('Không tải được danh sách hệ thống voucher: ' + err.message);
    }
  }

  companySelect.addEventListener('change', async () => {
    unitSelect.value = '';
    await loadUnits(companySelect.value || null);
    if (onChange) onChange();
  });
  unitSelect.addEventListener('change', () => onChange && onChange());
  userSelect.addEventListener('change', () => onChange && onChange());
}

/** Doc gia tri hien tai cua cac o loc, dang object dung thang trong URLSearchParams. */
function getReportFilterParams() {
  const companySelect = document.getElementById('filterCompany');
  const unitSelect = document.getElementById('filterUnit');
  const userSelect = document.getElementById('filterUser');
  const systemSelect = document.getElementById('filterSystem');
  const params = {};
  if (companySelect && companySelect.value) params.companyId = companySelect.value;
  if (unitSelect && unitSelect.value) params.redemptionUnitId = unitSelect.value;
  if (userSelect && userSelect.value) params.userId = userSelect.value;
  if (systemSelect && systemSelect.value) params.connectionId = systemSelect.value;
  return params;
}

function escapeHtmlFilter(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
