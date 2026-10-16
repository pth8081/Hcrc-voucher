/**
 * Dung chung cho 3 man hinh bao cao (doi soat, tong hop, danh sach voucher da su dung) - nap gia
 * tri cho 3 o loc Cong ty thu / Diem thu hoi / Tai khoan thu hoi va xu ly cascading Cong ty ->
 * Diem thu hoi (chon cong ty truoc se loc lai danh sach diem thu hoi tuong ung, giong cach
 * units.js lam voi form tao Diem thu hoi). Yeu cau san 3 the <select> trong trang voi id:
 * filterCompany, filterUnit, filterUser.
 */
async function initReportFilters(onChange) {
  const companySelect = document.getElementById('filterCompany');
  const unitSelect = document.getElementById('filterUnit');
  const userSelect = document.getElementById('filterUser');
  if (!companySelect || !unitSelect || !userSelect) return;

  async function loadUnits(companyId) {
    const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    const units = await apiFetch(`/reports/filters/redemption-units${query}`);
    const current = unitSelect.value;
    unitSelect.innerHTML =
      '<option value="">Tat ca diem thu hoi</option>' +
      units.map((u) => `<option value="${u.Id}">${escapeHtmlFilter(u.PartnerName || '(chua co ten)')}</option>`).join('');
    if (current && units.some((u) => String(u.Id) === current)) unitSelect.value = current;
  }

  try {
    const [companies, redeemers] = await Promise.all([
      apiFetch('/reports/filters/companies'),
      apiFetch('/reports/filters/redeemers'),
    ]);
    companySelect.innerHTML =
      '<option value="">Tat ca cong ty</option>' +
      companies.map((c) => `<option value="${c.Id}">${escapeHtmlFilter(c.CompanyName)}</option>`).join('');
    userSelect.innerHTML =
      '<option value="">Tat ca tai khoan</option>' +
      redeemers.map((r) => `<option value="${r.userId}">${escapeHtmlFilter(r.userName || '(khong ro)')}</option>`).join('');
    await loadUnits(null);
  } catch (err) {
    showToast('Khong tai duoc danh sach loc: ' + err.message);
  }

  companySelect.addEventListener('change', async () => {
    unitSelect.value = '';
    await loadUnits(companySelect.value || null);
    if (onChange) onChange();
  });
  unitSelect.addEventListener('change', () => onChange && onChange());
  userSelect.addEventListener('change', () => onChange && onChange());
}

/** Doc gia tri hien tai cua 3 o loc, dang object dung thang trong URLSearchParams. */
function getReportFilterParams() {
  const companySelect = document.getElementById('filterCompany');
  const unitSelect = document.getElementById('filterUnit');
  const userSelect = document.getElementById('filterUser');
  const params = {};
  if (companySelect && companySelect.value) params.companyId = companySelect.value;
  if (unitSelect && unitSelect.value) params.redemptionUnitId = unitSelect.value;
  if (userSelect && userSelect.value) params.userId = userSelect.value;
  return params;
}

function escapeHtmlFilter(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
