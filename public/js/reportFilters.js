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
 * v3.96: "Diem thu hoi" doi tu 1 <select> chon DON sang 1 o CHECKBOX NHIEU diem (dropdown bam mo -
 * giong cach da doi cho man "Lich gui email bao cao") - theo yeu cau nguoi dung, muon xem gop bao
 * cao cua nhieu diem CUNG 1 luc thay vi phai doi qua lai tung diem. Yeu cau san #filterUnit la 1
 * <div> (KHONG con la <select>) chua san .unit-multiselect-toggle (nut bam mo) va
 * .unit-multiselect-panel (khung checkbox, ban dau rong - JS tu dien).
 *
 * Yeu cau san cac phan tu trong trang voi id: filterCompany, filterUnit, filterUser, filterSystem
 * (filterSystem la TUY CHON - bo qua gon neu trang khong co o nay).
 */
async function initReportFilters(onChange) {
  const companySelect = document.getElementById('filterCompany');
  const unitMultiselect = document.getElementById('filterUnit');
  const unitToggle = unitMultiselect ? unitMultiselect.querySelector('.unit-multiselect-toggle') : null;
  const unitPanel = unitMultiselect ? unitMultiselect.querySelector('.unit-multiselect-panel') : null;
  const userSelect = document.getElementById('filterUser');
  const systemSelect = document.getElementById('filterSystem');
  const systemField = document.getElementById('filterSystemField');
  if (!companySelect || !unitMultiselect || !unitToggle || !unitPanel || !userSelect) return;

  // Chi tai khoan dang xem bao cao nay THAT SU dung tu 2 he thong voucher tro len moi can o
  // chon "He thong" (xem cmt o duoi, giu nguyen dung quyet dinh nay 1 lan luc init - khong an/
  // hien lai o nay moi lan doi Diem thu hoi, chi loc lai danh sach LUA CHON ben trong).
  let systemFilterEnabled = false;

  function getSelectedUnitIds() {
    return Array.from(unitPanel.querySelectorAll('.unit-checkbox:checked')).map((el) => Number(el.value));
  }

  function updateUnitToggleLabel(units) {
    const selectedIds = getSelectedUnitIds();
    if (!selectedIds.length) {
      unitToggle.textContent = 'Tất cả điểm thu hồi';
      return;
    }
    if (selectedIds.length === 1) {
      const u = units.find((x) => x.Id === selectedIds[0]);
      unitToggle.textContent = u ? (u.PartnerName || '(chưa có tên)') : '1 điểm đã chọn';
      return;
    }
    unitToggle.textContent = `${selectedIds.length} điểm đã chọn`;
  }

  async function loadUnits(companyId) {
    const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    const units = await apiFetch(`/reports/filters/redemption-units${query}`);
    const prevSelected = new Set(getSelectedUnitIds());
    unitPanel.innerHTML = units.length
      ? units
          .map(
            (u) => `
          <label>
            <input type="checkbox" class="unit-checkbox" value="${u.Id}" ${prevSelected.has(u.Id) ? 'checked' : ''} />
            ${escapeHtmlFilter(u.PartnerName || '(chưa có tên)')}
          </label>`
          )
          .join('')
      : '<p class="text-muted" style="margin:4px 8px;">Không có điểm thu hồi nào.</p>';
    unitPanel.querySelectorAll('.unit-checkbox').forEach((cb) => {
      cb.addEventListener('change', async () => {
        updateUnitToggleLabel(units);
        const unitIds = getSelectedUnitIds();
        await Promise.all([loadRedeemers(unitIds), loadSystems(unitIds)]);
        if (onChange) onChange();
      });
    });
    updateUnitToggleLabel(units);
  }

  async function loadRedeemers(unitIds) {
    const query = unitIds && unitIds.length ? `?redemptionUnitId=${unitIds.join(',')}` : '';
    const redeemers = await apiFetch(`/reports/filters/redeemers${query}`);
    const current = userSelect.value;
    userSelect.innerHTML =
      '<option value="">Tất cả tài khoản</option>' +
      redeemers.map((r) => `<option value="${r.userId}">${escapeHtmlFilter(r.userName || '(không rõ)')}</option>`).join('');
    if (current && redeemers.some((r) => String(r.userId) === current)) userSelect.value = current;
  }

  async function loadSystems(unitIds) {
    if (!systemSelect || !systemField || !systemFilterEnabled) return;
    const query = unitIds && unitIds.length ? `?redemptionUnitId=${unitIds.join(',')}` : '';
    const systems = await apiFetch(`/reports/filters/systems${query}`);
    const current = systemSelect.value;
    systemSelect.innerHTML =
      '<option value="">Tất cả hệ thống</option>' +
      systems.map((s) => `<option value="${s.id}">${escapeHtmlFilter(s.name)}</option>`).join('');
    if (current && systems.some((s) => String(s.id) === current)) systemSelect.value = current;
  }

  // Bam mo/dong khung checkbox - dong khi bam ra ngoai, khong dong khi dang bam ben TRONG khung
  // (vd dang tick checkbox) de khong bi ngat giua chung 1 lan tick nhieu diem lien tiep.
  unitToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    unitPanel.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!unitMultiselect.contains(e.target)) unitPanel.classList.remove('open');
  });

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
    // Doi cong ty coi nhu bo chon het Diem thu hoi dang tick (danh sach ben duoi se doi hoan
    // toan sang cong ty moi) - tra Tai khoan/He thong ve lai danh sach KHONG loc theo diem,
    // tranh giu lai danh sach da thu hep boi 1 diem thuoc cong ty cu (co the khong con hop le o
    // cong ty moi).
    await loadUnits(companySelect.value || null);
    document.querySelectorAll('#filterUnit .unit-checkbox').forEach((cb) => { cb.checked = false; });
    updateUnitToggleLabel([]);
    await Promise.all([loadRedeemers([]), loadSystems([])]);
    if (onChange) onChange();
  });
  userSelect.addEventListener('change', () => onChange && onChange());
}

/** Doc gia tri hien tai cua cac o loc, dang object dung thang trong URLSearchParams. redemptionUnitId
 * (neu co chon) la chuoi nhieu id cach nhau dau phay (vd "3,7,12") - xem report.controller.js#parseIdListParam. */
function getReportFilterParams() {
  const companySelect = document.getElementById('filterCompany');
  const unitMultiselect = document.getElementById('filterUnit');
  const userSelect = document.getElementById('filterUser');
  const systemSelect = document.getElementById('filterSystem');
  const params = {};
  if (companySelect && companySelect.value) params.companyId = companySelect.value;
  if (unitMultiselect) {
    const ids = Array.from(unitMultiselect.querySelectorAll('.unit-checkbox:checked')).map((el) => el.value);
    if (ids.length) params.redemptionUnitId = ids.join(',');
  }
  if (userSelect && userSelect.value) params.userId = userSelect.value;
  if (systemSelect && systemSelect.value) params.connectionId = systemSelect.value;
  return params;
}

function escapeHtmlFilter(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
