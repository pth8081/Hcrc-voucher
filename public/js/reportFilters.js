/**
 * Dung chung cho 3 man hinh bao cao (doi soat, tong hop, danh sach voucher da su dung) - nap gia
 * tri cho 4 o loc Cong ty thu / Diem thu hoi / Tai khoan thu hoi / He thong voucher va xu ly
 * cascading: Cong ty -> Diem thu hoi (chon cong ty truoc se loc lai danh sach diem thu hoi tuong
 * ung, giong cach units.js lam voi form tao Diem tieu), va Diem thu hoi -> Tai khoan + He thong
 * voucher (M11 - loi that da bao cao: truoc day chon 1 Diem thu hoi khong loc lai o "Tai khoan
 * thu hoi"/"He thong voucher", nen chon duoc 1 to hop khong lien quan gi nhau - vd 1 tai khoan
 * chua bao gio gan diem dang chon - luon ra bao cao rong, gay nham lan. Gio chon 1 Diem thu hoi
 * se CHI con hien cac tai khoan DANG gan dung diem do (Users.Locations_Detail) va cac he thong
 * voucher duoc IT NHAT 1 trong so cac tai khoan do dung - xem reportService.js#listFilterRedeemers
 * va userVoucherSystemService.js#getAllowedConnectionIdsForLocation).
 *
 * Yeu cau san cac the <select> trong trang voi id: filterCompany, filterUnit, filterUser,
 * filterSystem (filterSystem la TUY CHON - bo qua gon neu trang khong co o nay).
 */
async function initReportFilters(onChange) {
  const companySelect = document.getElementById('filterCompany');
  const unitSelect = document.getElementById('filterUnit');
  const userSelect = document.getElementById('filterUser');
  const systemSelect = document.getElementById('filterSystem');
  const systemField = document.getElementById('filterSystemField');
  if (!companySelect || !unitSelect || !userSelect) return;

  // Chi tai khoan dang xem bao cao nay THAT SU dung tu 2 he thong voucher tro len moi can o
  // chon "He thong" (xem cmt o duoi, giu nguyen dung quyet dinh nay 1 lan luc init - khong an/
  // hien lai o nay moi lan doi Diem thu hoi, chi loc lai danh sach LUA CHON ben trong).
  let systemFilterEnabled = false;

  async function loadUnits(companyId) {
    const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    const units = await apiFetch(`/reports/filters/redemption-units${query}`);
    const current = unitSelect.value;
    unitSelect.innerHTML =
      '<option value="">Tất cả điểm thu hồi</option>' +
      units.map((u) => `<option value="${u.Id}">${escapeHtmlFilter(u.PartnerName || '(chưa có tên)')}</option>`).join('');
    if (current && units.some((u) => String(u.Id) === current)) unitSelect.value = current;
  }

  async function loadRedeemers(redemptionUnitId) {
    const query = redemptionUnitId ? `?redemptionUnitId=${encodeURIComponent(redemptionUnitId)}` : '';
    const redeemers = await apiFetch(`/reports/filters/redeemers${query}`);
    const current = userSelect.value;
    userSelect.innerHTML =
      '<option value="">Tất cả tài khoản</option>' +
      redeemers.map((r) => `<option value="${r.userId}">${escapeHtmlFilter(r.userName || '(không rõ)')}</option>`).join('');
    if (current && redeemers.some((r) => String(r.userId) === current)) userSelect.value = current;
  }

  async function loadSystems(redemptionUnitId) {
    if (!systemSelect || !systemField || !systemFilterEnabled) return;
    const query = redemptionUnitId ? `?redemptionUnitId=${encodeURIComponent(redemptionUnitId)}` : '';
    const systems = await apiFetch(`/reports/filters/systems${query}`);
    const current = systemSelect.value;
    systemSelect.innerHTML =
      '<option value="">Tất cả hệ thống</option>' +
      systems.map((s) => `<option value="${s.id}">${escapeHtmlFilter(s.name)}</option>`).join('');
    if (current && systems.some((s) => String(s.id) === current)) systemSelect.value = current;
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
        systemFilterEnabled = true;
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
    // Doi cong ty coi nhu bo chon Diem thu hoi (o tren vua reset ve "Tat ca diem thu hoi") -
    // tra Tai khoan/He thong ve lai danh sach KHONG loc theo diem, tranh giu lai danh sach da
    // thu hep boi 1 diem thuoc cong ty cu (co the khong con hop le o cong ty moi).
    await Promise.all([loadRedeemers(null), loadSystems(null)]);
    if (onChange) onChange();
  });
  unitSelect.addEventListener('change', async () => {
    const redemptionUnitId = unitSelect.value || null;
    await Promise.all([loadRedeemers(redemptionUnitId), loadSystems(redemptionUnitId)]);
    if (onChange) onChange();
  });
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
