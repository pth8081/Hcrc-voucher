requireAuth();
renderTopbar('units');

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tabCompanies').classList.toggle('hidden', btn.dataset.tab !== 'companies');
    document.getElementById('tabUnits').classList.toggle('hidden', btn.dataset.tab !== 'units');
    document.getElementById('tabAccess').classList.toggle('hidden', btn.dataset.tab !== 'access');
  });
});

const notAdminNotice = document.getElementById('notAdminNotice');
const unitsCard = document.getElementById('unitsCard');
const unitsBody = document.getElementById('unitsBody');
const companiesBody = document.getElementById('companiesBody');
const locationSelect = document.getElementById('locationDetailId');
const companySelect = document.getElementById('companyId');
const unitForm = document.getElementById('unitForm');
const locationForm = document.getElementById('locationForm');
const companyForm = document.getElementById('companyForm');
const accessGroupForm = document.getElementById('accessGroupForm');
const accessGroupsBody = document.getElementById('accessGroupsBody');
const scopeTypeSelect = document.getElementById('scopeType');
const groupCompaniesField = document.getElementById('groupCompaniesField');
const groupCompaniesList = document.getElementById('groupCompaniesList');

const companyFormTitle = document.getElementById('companyFormTitle');
const companySubmitBtn = document.getElementById('companySubmitBtn');
const companyCancelBtn = document.getElementById('companyCancelBtn');
const unitFormTitle = document.getElementById('unitFormTitle');
const unitSubmitBtn = document.getElementById('unitSubmitBtn');
const unitCancelBtn = document.getElementById('unitCancelBtn');
const accessGroupFormTitle = document.getElementById('accessGroupFormTitle');
const accessGroupSubmitBtn = document.getElementById('accessGroupSubmitBtn');
const accessGroupCancelBtn = document.getElementById('accessGroupCancelBtn');

let companiesCache = [];
let locationsCache = [];
let unitsCache = [];
let accessGroupsCache = [];
let voucherConnectionsCache = [];
const companyPartnerConnectionSelect = document.getElementById('companyPartnerConnection');
// Dung chung 1 "mo hinh sua" cho ca 3 danh sach (Cong ty/Diem tieu/Nhom quyen): bam "Sua" tren 1
// dong se DO LAI chinh form "Them..." o tren (gon hon rat nhieu so voi sua ngay tren dong bang,
// vi cac form nay co toi 9-10 truong) - giong het cach man "Ket noi API" lam, dung
// editingXxxId !== null de biet dang o che do sua, PUT thay vi POST luc luu, "Huy sua" de quay
// lai che do tao moi ma khong luu gi.
let editingCompanyId = null;
let editingUnitId = null;
let editingAccessGroupId = null;

(async function init() {
  try {
    await loadLocations();
  } catch (err) {
    notAdminNotice.classList.remove('hidden');
    unitsCard.classList.add('hidden');
    return;
  }
  await loadVoucherConnections();
  await loadCompanies();
  await loadUnits();
  await loadAccessGroups();
  renderGroupCompaniesCheckboxes();
})();

/** v3.81 (diem 4): danh sach he thong voucher (doi tac) de gan cho 1 cong ty luc tao/sua - dung
 * lai y nghia con co san o man hinh "Tai khoan" (vd o chon "Quan tri doi tac"). Khong chan loi
 * cung nhu cac GET khac trong file nay (mo cho moi tai khoan Quan tri du khong co quyen
 * adminCanManageConnections - xem apiConnection.routes.js). */
async function loadVoucherConnections() {
  try {
    voucherConnectionsCache = await apiFetch('/api-connections');
  } catch (err) {
    voucherConnectionsCache = [];
  }
  companyPartnerConnectionSelect.innerHTML =
    '<option value="">-- Công ty của HCRC (không gán đối tác) --</option>' +
    voucherConnectionsCache.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}

async function loadLocations() {
  locationsCache = await apiFetch('/locations/details');
  locationSelect.innerHTML = locationsCache
    .map((d) => `<option value="${d.id}">${escapeHtml(d.LocationName)} (${escapeHtml(d.LocationCode)})</option>`)
    .join('');
  renderLocationsList();
}

const locationsBody = document.getElementById('locationsBody');
let editingLocationId = null;

/** Danh sach "Dia diem" voi nut Sua tai cho (doi lai LocationName, vd go sai chinh ta luc tao
 * qua form "Them dia diem moi" ben tren) - khong co nut Sua nao o day truoc do. */
function renderLocationsList() {
  if (!locationsBody) return;
  if (!locationsCache.length) {
    locationsBody.innerHTML = '<tr><td colspan="3" class="text-muted">Chưa có địa điểm nào</td></tr>';
    return;
  }
  locationsBody.innerHTML = locationsCache
    .map((d) => {
      if (editingLocationId === d.id) {
        return `
          <tr>
            <td data-label="Tên địa điểm"><input type="text" class="edit-location-name" value="${escapeHtml(d.LocationName)}" /></td>
            <td data-label="Trạng thái">${d.Status ? 'Hoạt động' : 'Ngừng'}</td>
            <td data-label="Hành động" class="actions-cell">
              <button type="button" class="btn-primary save-location-btn" data-id="${d.id}">Lưu</button>
              <button type="button" class="btn-secondary cancel-location-btn">Hủy</button>
            </td>
          </tr>`;
      }
      return `
        <tr>
          <td data-label="Tên địa điểm">${escapeHtml(d.LocationName)}</td>
          <td data-label="Trạng thái">${d.Status ? 'Hoạt động' : 'Ngừng'}</td>
          <td data-label="Hành động" class="actions-cell">
            <button type="button" class="btn-secondary edit-location-btn" data-id="${d.id}">Sửa</button>
          </td>
        </tr>`;
    })
    .join('');

  locationsBody.querySelectorAll('.edit-location-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      editingLocationId = Number(btn.dataset.id);
      renderLocationsList();
    });
  });
  locationsBody.querySelectorAll('.cancel-location-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      editingLocationId = null;
      renderLocationsList();
    });
  });
  locationsBody.querySelectorAll('.save-location-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const input = locationsBody.querySelector('.edit-location-name');
      const locationName = input.value.trim();
      if (!locationName) {
        showToast('Tên địa điểm không được để trống');
        return;
      }
      btn.disabled = true;
      try {
        await apiFetch(`/locations/details/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ locationName }),
        });
        showToast('Đã cập nhật địa điểm');
        editingLocationId = null;
        await loadLocations();
      } catch (err) {
        showToast(err.message);
        btn.disabled = false;
      }
    });
  });
}

locationForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const locationNameInput = document.getElementById('newLocationName');
  const locationName = locationNameInput.value.trim();

  await withSubmitLock(locationForm, async () => {
    try {
      const result = await apiFetch('/locations/details', {
        method: 'POST',
        body: JSON.stringify({ locationName }),
      });
      showToast(`Đã tạo địa điểm "${locationName}"`);
      locationForm.reset();
      await loadLocations();
      // Chon san dia diem vua tao trong form "Them diem tieu" ben duoi, de admin khong phai
      // tim lai trong danh sach dai - tiep tuc dien cac o con lai roi luu diem tieu ngay.
      locationSelect.value = String(result.id);
    } catch (err) {
      showToast(err.message);
    }
  });
});

async function loadCompanies() {
  try {
    companiesCache = await apiFetch('/companies');
    // "Cong ty doi tac" (CompanyType = 'PARTNER', xem sql/043) khong the gan Diem tieu - an khoi
    // o chon "Cong ty" cua form "Them diem tieu" ben duoi (server cung tu chan neu co tinh gui
    // thang len, xem redemptionUnitService.js#assertCompanyAllowsUnits).
    const redemptionCompanies = companiesCache.filter((c) => c.CompanyType !== 'PARTNER');
    companySelect.innerHTML = redemptionCompanies
      .map((c) => `<option value="${c.Id}">${escapeHtml(c.CompanyName)} (${escapeHtml(c.CompanyCode)})</option>`)
      .join('');
    renderCompanies();
    renderGroupCompaniesCheckboxes();
  } catch (err) {
    showToast(err.message);
  }
}

/** Ten doi tac hien thi cho 1 cong ty, resolve phia trinh duyet tu voucherConnectionsCache (GET
 * /companies tra ve CreatedByPartnerConnectionId nhung khong JOIN san ten, tranh sua them 1 cau
 * query chi de phuc vu 1 cot hien thi) - "-" neu la cong ty cua HCRC (khong gan doi tac). */
function companyPartnerName(c) {
  if (!c.CreatedByPartnerConnectionId) return '-';
  const conn = voucherConnectionsCache.find((v) => v.id === c.CreatedByPartnerConnectionId);
  return conn ? escapeHtml(conn.name) : '-';
}

function renderCompanies() {
  if (!companiesCache.length) {
    companiesBody.innerHTML = '<tr><td colspan="7" class="text-muted">Chưa có công ty nào</td></tr>';
    return;
  }
  companiesBody.innerHTML = companiesCache
    .map(
      (c) => `
      <tr>
        <td data-label="Mã">${escapeHtml(c.CompanyCode)}</td>
        <td data-label="Tên công ty">${escapeHtml(c.CompanyName)}</td>
        <td data-label="Loại công ty">${c.CompanyType === 'PARTNER' ? '<span class="status-badge status-other">CÔNG TY ĐỐI TÁC</span>' : '<span class="status-badge status-unused">CÔNG TY THU HỒI</span>'}</td>
        <td data-label="Thuộc đối tác">${c.CreatedByPartnerConnectionId ? `<span class="status-badge status-other">${companyPartnerName(c)}</span>` : '<span class="text-muted">-</span>'}</td>
        <td data-label="Liên hệ">${escapeHtml(c.ContactName || '-')} ${c.ContactPhone ? '(' + escapeHtml(c.ContactPhone) + ')' : ''}</td>
        <td data-label="Số điểm tiêu" id="unit-count-${c.Id}">${c.CompanyType === 'PARTNER' ? '<span class="text-muted">- (không áp dụng)</span>' : '-'}</td>
        <td data-label="Trạng thái">${c.Status ? 'Hoạt động' : 'Ngừng'}</td>
        <td data-label="Hành động" class="actions-cell">
          <button type="button" class="btn-secondary edit-company-btn" data-id="${c.Id}">Sửa</button>
          <button type="button" class="btn-danger delete-company-btn" data-id="${c.Id}">Xóa</button>
        </td>
      </tr>`
    )
    .join('');

  companiesBody.querySelectorAll('.edit-company-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const company = companiesCache.find((c) => c.Id === Number(btn.dataset.id));
      if (company) populateCompanyForm(company);
    });
  });
  companiesBody.querySelectorAll('.delete-company-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteCompany(Number(btn.dataset.id)));
  });
}

function populateCompanyForm(c) {
  editingCompanyId = c.Id;
  companyFormTitle.textContent = `Sửa công ty: ${c.CompanyName}`;
  document.getElementById('companyCode').value = c.CompanyCode || '';
  document.getElementById('companyName').value = c.CompanyName || '';
  document.getElementById('companyType').value = c.CompanyType === 'PARTNER' ? 'PARTNER' : 'REDEMPTION';
  companyPartnerConnectionSelect.value = c.CreatedByPartnerConnectionId ? String(c.CreatedByPartnerConnectionId) : '';
  document.getElementById('companyContactName').value = c.ContactName || '';
  document.getElementById('companyContactPhone').value = c.ContactPhone || '';
  document.getElementById('companyContactEmail').value = c.ContactEmail || '';
  document.getElementById('companyAddress').value = c.Address || '';
  document.getElementById('companyTaxCode').value = c.TaxCode || '';
  document.getElementById('companyBankAccount').value = c.BankAccount || '';
  document.getElementById('companyBankName').value = c.BankName || '';
  companySubmitBtn.textContent = 'Cập nhật công ty';
  companyCancelBtn.classList.remove('hidden');
  companyForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetCompanyForm() {
  editingCompanyId = null;
  companyFormTitle.textContent = 'Thêm công ty';
  companyForm.reset();
  companySubmitBtn.textContent = 'Lưu công ty';
  companyCancelBtn.classList.add('hidden');
}
companyCancelBtn.addEventListener('click', resetCompanyForm);

async function deleteCompany(id) {
  const company = companiesCache.find((c) => c.Id === id);
  if (!company) return;
  if (!confirm(`Xóa công ty "${company.CompanyName}"? Không thể hoàn tác.`)) return;
  try {
    await apiFetch(`/companies/${id}`, { method: 'DELETE' });
    showToast('Đã xóa công ty');
    if (editingCompanyId === id) resetCompanyForm();
    await loadCompanies();
    await loadUnits();
  } catch (err) {
    showToast(err.message);
  }
}

async function loadUnits() {
  try {
    unitsCache = await apiFetch('/redemption-units');
    renderUnits();

    const countByCompany = {};
    unitsCache.forEach((u) => {
      if (u.CompanyId) countByCompany[u.CompanyId] = (countByCompany[u.CompanyId] || 0) + 1;
    });
    companiesCache.forEach((c) => {
      // "Cong ty doi tac" luon hien "- (khong ap dung)" (dat san o renderCompanies(), xem sql/043) -
      // khong ghi de bang so dem o day vi loai cong ty nay khong bao gio co Diem tieu.
      if (c.CompanyType === 'PARTNER') return;
      const cell = document.getElementById(`unit-count-${c.Id}`);
      if (cell) cell.textContent = countByCompany[c.Id] || 0;
    });
  } catch (err) {
    showToast(err.message);
  }
}

function renderUnits() {
  if (!unitsCache.length) {
    unitsBody.innerHTML = '<tr><td colspan="7" class="text-muted">Chưa có điểm tiêu nào</td></tr>';
    return;
  }
  unitsBody.innerHTML = unitsCache
    .map(
      (u) => `
      <tr>
        <td data-label="Mã điểm">${escapeHtml(u.PartnerCode)}</td>
        <td data-label="Tên điểm tiêu">${escapeHtml(u.PartnerName)}</td>
        <td data-label="Công ty">${escapeHtml(u.CompanyName || '-')}</td>
        <td data-label="Địa điểm">${escapeHtml(u.LocationName || '-')}</td>
        <td data-label="Liên hệ">${escapeHtml(u.ContactName || '-')} ${u.ContactPhone ? '(' + escapeHtml(u.ContactPhone) + ')' : ''}</td>
        <td data-label="Trạng thái">${u.Status ? 'Hoạt động' : 'Ngừng'}</td>
        <td data-label="Hành động" class="actions-cell">
          <button type="button" class="btn-secondary edit-unit-btn" data-id="${u.Id}">Sửa</button>
          <button type="button" class="btn-danger delete-unit-btn" data-id="${u.Id}">Xóa</button>
        </td>
      </tr>`
    )
    .join('');

  unitsBody.querySelectorAll('.edit-unit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const unit = unitsCache.find((u) => u.Id === Number(btn.dataset.id));
      if (unit) populateUnitForm(unit);
    });
  });
  unitsBody.querySelectorAll('.delete-unit-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteUnit(Number(btn.dataset.id)));
  });
}

function populateUnitForm(u) {
  editingUnitId = u.Id;
  unitFormTitle.textContent = `Sửa điểm tiêu: ${u.PartnerName}`;
  companySelect.value = String(u.CompanyId || '');
  locationSelect.value = String(u.LocationDetailId || '');
  document.getElementById('partnerCode').value = u.PartnerCode || '';
  document.getElementById('partnerName').value = u.PartnerName || '';
  document.getElementById('contactName').value = u.ContactName || '';
  document.getElementById('contactPhone').value = u.ContactPhone || '';
  document.getElementById('contactEmail').value = u.ContactEmail || '';
  document.getElementById('address').value = u.Address || '';
  document.getElementById('taxCode').value = u.TaxCode || '';
  document.getElementById('bankAccount').value = u.BankAccount || '';
  document.getElementById('bankName').value = u.BankName || '';
  document.getElementById('dailyLimitAmount').value = u.DailyLimitAmount || '';
  unitSubmitBtn.textContent = 'Cập nhật điểm tiêu';
  unitCancelBtn.classList.remove('hidden');
  unitForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetUnitForm() {
  editingUnitId = null;
  unitFormTitle.textContent = 'Thêm điểm tiêu';
  unitForm.reset();
  unitSubmitBtn.textContent = 'Lưu điểm tiêu';
  unitCancelBtn.classList.add('hidden');
}
unitCancelBtn.addEventListener('click', resetUnitForm);

async function deleteUnit(id) {
  const unit = unitsCache.find((u) => u.Id === id);
  if (!unit) return;
  if (!confirm(`Xóa điểm tiêu "${unit.PartnerName}"? Không thể hoàn tác.`)) return;
  try {
    await apiFetch(`/redemption-units/${id}`, { method: 'DELETE' });
    showToast('Đã xóa điểm tiêu');
    if (editingUnitId === id) resetUnitForm();
    await loadUnits();
  } catch (err) {
    showToast(err.message);
  }
}

function renderGroupCompaniesCheckboxes() {
  // "Cong ty doi tac" (CompanyType = 'PARTNER') khong bao gio co du lieu bao cao (khong the gan
  // Diem tieu, xem sql/043) - an khoi danh sach cap quyen xem cheo bao cao, tranh gay nham lan.
  const reportCompanies = companiesCache.filter((c) => c.CompanyType !== 'PARTNER');
  if (!reportCompanies.length) {
    groupCompaniesList.innerHTML = '<span class="text-muted">Chưa có công ty nào</span>';
    return;
  }
  groupCompaniesList.innerHTML = reportCompanies
    .map(
      (c) => `
      <label class="checkbox-inline">
        <input type="checkbox" class="groupCompanyCheckbox" value="${c.Id}" />
        ${escapeHtml(c.CompanyName)} (${escapeHtml(c.CompanyCode)})
      </label>`
    )
    .join('');
}

function toggleGroupCompaniesField() {
  groupCompaniesField.style.display = scopeTypeSelect.value === 'SPECIFIC' ? '' : 'none';
}
scopeTypeSelect.addEventListener('change', toggleGroupCompaniesField);
toggleGroupCompaniesField();

async function loadAccessGroups() {
  try {
    accessGroupsCache = await apiFetch('/access-groups');
    renderAccessGroups(accessGroupsCache);
  } catch (err) {
    showToast(err.message);
  }
}

function renderAccessGroups(data) {
  if (!data.length) {
    accessGroupsBody.innerHTML = '<tr><td colspan="4" class="text-muted">Chưa có nhóm quyền nào</td></tr>';
    return;
  }
  accessGroupsBody.innerHTML = data
    .map(
      (g) => `
      <tr>
        <td data-label="Tên nhóm">${escapeHtml(g.GroupName)}</td>
        <td data-label="Phạm vi">${g.ScopeType === 'ALL' ? 'Toàn bộ công ty' : 'Chỉ định công ty'}</td>
        <td data-label="Công ty được xem thêm">${g.ScopeType === 'ALL' ? '-' : (g.companies.map((c) => escapeHtml(c.companyName)).join(', ') || '-')}</td>
        <td data-label="Hành động" class="actions-cell">
          <button type="button" class="btn-secondary edit-access-group-btn" data-id="${g.Id}">Sửa</button>
          <button type="button" class="btn-danger delete-access-group-btn" data-id="${g.Id}">Xóa</button>
        </td>
      </tr>`
    )
    .join('');

  accessGroupsBody.querySelectorAll('.edit-access-group-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = accessGroupsCache.find((g) => g.Id === Number(btn.dataset.id));
      if (group) populateAccessGroupForm(group);
    });
  });
  accessGroupsBody.querySelectorAll('.delete-access-group-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteAccessGroup(Number(btn.dataset.id)));
  });
}

function populateAccessGroupForm(g) {
  editingAccessGroupId = g.Id;
  accessGroupFormTitle.textContent = `Sửa nhóm quyền: ${g.GroupName}`;
  document.getElementById('groupName').value = g.GroupName || '';
  scopeTypeSelect.value = g.ScopeType;
  toggleGroupCompaniesField();
  renderGroupCompaniesCheckboxes();
  const companyIds = (g.companies || []).map((c) => c.companyId);
  document.querySelectorAll('.groupCompanyCheckbox').forEach((cb) => {
    cb.checked = companyIds.includes(Number(cb.value));
  });
  accessGroupSubmitBtn.textContent = 'Cập nhật nhóm quyền';
  accessGroupCancelBtn.classList.remove('hidden');
  accessGroupForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetAccessGroupForm() {
  editingAccessGroupId = null;
  accessGroupFormTitle.textContent = 'Thêm nhóm quyền xem báo cáo';
  accessGroupForm.reset();
  toggleGroupCompaniesField();
  renderGroupCompaniesCheckboxes();
  accessGroupSubmitBtn.textContent = 'Lưu nhóm quyền';
  accessGroupCancelBtn.classList.add('hidden');
}
accessGroupCancelBtn.addEventListener('click', resetAccessGroupForm);

async function deleteAccessGroup(id) {
  const group = accessGroupsCache.find((g) => g.Id === id);
  if (!group) return;
  if (!confirm(`Xóa nhóm quyền "${group.GroupName}"? Không thể hoàn tác.`)) return;
  try {
    await apiFetch(`/access-groups/${id}`, { method: 'DELETE' });
    showToast('Đã xóa nhóm quyền');
    if (editingAccessGroupId === id) resetAccessGroupForm();
    await loadAccessGroups();
  } catch (err) {
    showToast(err.message);
  }
}

accessGroupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const scopeType = scopeTypeSelect.value;
  const companyIds = Array.from(document.querySelectorAll('.groupCompanyCheckbox:checked')).map((el) => Number(el.value));
  if (scopeType === 'SPECIFIC' && !companyIds.length) {
    showToast('Vui lòng chọn ít nhất 1 công ty');
    return;
  }
  const payload = {
    groupName: document.getElementById('groupName').value.trim(),
    scopeType,
    companyIds,
  };
  // Dot ra soat sau phat hien: khoa nut trong luc cho phan hoi, tranh mang cham + bam nham 2
  // lan tao ra 2 nhom quyen trung ten (GroupName truoc day khong co rang buoc UNIQUE, xem
  // sql/018_add_unique_group_name.sql).
  await withSubmitLock(accessGroupForm, async () => {
    try {
      if (editingAccessGroupId) {
        await apiFetch(`/access-groups/${editingAccessGroupId}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Đã cập nhật nhóm quyền');
      } else {
        await apiFetch('/access-groups', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Đã lưu nhóm quyền');
      }
      resetAccessGroupForm();
      await loadAccessGroups();
    } catch (err) {
      showToast(err.message);
    }
  });
});

/** true = tiep tuc luu binh thuong; false = nguoi dung bam "Huy" o hop thoai xac nhan (dung khi
 * CHUYEN 1 cong ty DANG co Diem tieu/tai khoan sang "Cong ty doi tac", xem sql/043) - khong co gi
 * de xac nhan (cong ty moi, hoac khong doi sang PARTNER) thi bo qua, tra ve true ngay. */
async function confirmConvertToPartnerIfNeeded(companyId, newType) {
  if (!companyId || newType !== 'PARTNER') return true;
  const current = companiesCache.find((c) => c.Id === companyId);
  if (!current || current.CompanyType === 'PARTNER') return true;
  let preview;
  try {
    preview = await apiFetch(`/companies/${companyId}/convert-preview`);
  } catch (err) {
    showToast(err.message);
    return false;
  }
  if (!preview.unitCount && !preview.accountCount) return true;
  return confirm(
    `Công ty "${current.CompanyName}" hiện đang có ${preview.unitCount} điểm tiêu và ${preview.accountCount} tài khoản đang gắn vào. ` +
      `Chuyển sang "Công ty đối tác" sẽ GỠ hết điểm tiêu khỏi công ty này (không xóa, chỉ gỡ liên kết) ` +
      `và TẮT chức năng thu hồi voucher của các tài khoản đó (tự động đổi thành "Tài khoản đối tác"). ` +
      `Dữ liệu đã thu hồi trước đó vẫn được giữ nguyên trong lịch sử. Bạn có chắc chắn muốn chuyển?`
  );
}

companyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const companyType = document.getElementById('companyType').value;
  const payload = {
    companyCode: document.getElementById('companyCode').value.trim(),
    companyName: document.getElementById('companyName').value.trim(),
    companyType,
    createdByPartnerConnectionId: companyPartnerConnectionSelect.value ? Number(companyPartnerConnectionSelect.value) : null,
    contactName: document.getElementById('companyContactName').value.trim(),
    contactPhone: document.getElementById('companyContactPhone').value.trim(),
    contactEmail: document.getElementById('companyContactEmail').value.trim(),
    address: document.getElementById('companyAddress').value.trim(),
    taxCode: document.getElementById('companyTaxCode').value.trim(),
    bankAccount: document.getElementById('companyBankAccount').value.trim(),
    bankName: document.getElementById('companyBankName').value.trim(),
  };

  if (!(await confirmConvertToPartnerIfNeeded(editingCompanyId, companyType))) return;

  await withSubmitLock(companyForm, async () => {
    try {
      if (editingCompanyId) {
        await apiFetch(`/companies/${editingCompanyId}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Đã cập nhật công ty');
      } else {
        await apiFetch('/companies', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Đã lưu công ty');
      }
      resetCompanyForm();
      await loadCompanies();
      loadUnits();
    } catch (err) {
      showToast(err.message);
    }
  });
});

unitForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    companyId: Number(companySelect.value),
    locationDetailId: Number(locationSelect.value),
    partnerCode: document.getElementById('partnerCode').value.trim(),
    partnerName: document.getElementById('partnerName').value.trim(),
    contactName: document.getElementById('contactName').value.trim(),
    contactPhone: document.getElementById('contactPhone').value.trim(),
    contactEmail: document.getElementById('contactEmail').value.trim(),
    address: document.getElementById('address').value.trim(),
    taxCode: document.getElementById('taxCode').value.trim(),
    bankAccount: document.getElementById('bankAccount').value.trim(),
    bankName: document.getElementById('bankName').value.trim(),
    dailyLimitAmount: document.getElementById('dailyLimitAmount').value || null,
  };

  await withSubmitLock(unitForm, async () => {
    try {
      if (editingUnitId) {
        await apiFetch(`/redemption-units/${editingUnitId}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Đã cập nhật điểm tiêu');
      } else {
        await apiFetch('/redemption-units', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Đã lưu điểm tiêu');
      }
      resetUnitForm();
      loadUnits();
    } catch (err) {
      showToast(err.message);
    }
  });
});

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
