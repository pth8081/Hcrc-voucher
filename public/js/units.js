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

let companiesCache = [];
let locationsCache = [];

(async function init() {
  try {
    await loadLocations();
  } catch (err) {
    notAdminNotice.classList.remove('hidden');
    unitsCard.classList.add('hidden');
    return;
  }
  await loadCompanies();
  await loadUnits();
  await loadAccessGroups();
  renderGroupCompaniesCheckboxes();
})();

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
    companySelect.innerHTML = companiesCache
      .map((c) => `<option value="${c.Id}">${escapeHtml(c.CompanyName)} (${escapeHtml(c.CompanyCode)})</option>`)
      .join('');
    renderCompanies();
    renderGroupCompaniesCheckboxes();
  } catch (err) {
    showToast(err.message);
  }
}

function renderCompanies() {
  if (!companiesCache.length) {
    companiesBody.innerHTML = '<tr><td colspan="5" class="text-muted">Chưa có công ty nào</td></tr>';
    return;
  }
  companiesBody.innerHTML = companiesCache
    .map(
      (c) => `
      <tr>
        <td data-label="Mã">${escapeHtml(c.CompanyCode)}</td>
        <td data-label="Tên công ty">${escapeHtml(c.CompanyName)}</td>
        <td data-label="Liên hệ">${escapeHtml(c.ContactName || '-')} ${c.ContactPhone ? '(' + escapeHtml(c.ContactPhone) + ')' : ''}</td>
        <td data-label="Số điểm tiêu" id="unit-count-${c.Id}">-</td>
        <td data-label="Trạng thái">${c.Status ? 'Hoạt động' : 'Ngừng'}</td>
      </tr>`
    )
    .join('');
}

async function loadUnits() {
  try {
    const data = await apiFetch('/redemption-units');
    if (!data.length) {
      unitsBody.innerHTML = '<tr><td colspan="6" class="text-muted">Chưa có điểm tiêu nào</td></tr>';
    } else {
      unitsBody.innerHTML = data
        .map(
          (u) => `
          <tr>
            <td data-label="Mã điểm">${escapeHtml(u.PartnerCode)}</td>
            <td data-label="Tên điểm tiêu">${escapeHtml(u.PartnerName)}</td>
            <td data-label="Công ty">${escapeHtml(u.CompanyName || '-')}</td>
            <td data-label="Địa điểm">${escapeHtml(u.LocationName || '-')}</td>
            <td data-label="Liên hệ">${escapeHtml(u.ContactName || '-')} ${u.ContactPhone ? '(' + escapeHtml(u.ContactPhone) + ')' : ''}</td>
            <td data-label="Trạng thái">${u.Status ? 'Hoạt động' : 'Ngừng'}</td>
          </tr>`
        )
        .join('');
    }

    const countByCompany = {};
    data.forEach((u) => {
      if (u.CompanyId) countByCompany[u.CompanyId] = (countByCompany[u.CompanyId] || 0) + 1;
    });
    companiesCache.forEach((c) => {
      const cell = document.getElementById(`unit-count-${c.Id}`);
      if (cell) cell.textContent = countByCompany[c.Id] || 0;
    });
  } catch (err) {
    showToast(err.message);
  }
}

function renderGroupCompaniesCheckboxes() {
  if (!companiesCache.length) {
    groupCompaniesList.innerHTML = '<span class="text-muted">Chưa có công ty nào</span>';
    return;
  }
  groupCompaniesList.innerHTML = companiesCache
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
    const data = await apiFetch('/access-groups');
    renderAccessGroups(data);
  } catch (err) {
    showToast(err.message);
  }
}

function renderAccessGroups(data) {
  if (!data.length) {
    accessGroupsBody.innerHTML = '<tr><td colspan="3" class="text-muted">Chưa có nhóm quyền nào</td></tr>';
    return;
  }
  accessGroupsBody.innerHTML = data
    .map(
      (g) => `
      <tr>
        <td data-label="Tên nhóm">${escapeHtml(g.GroupName)}</td>
        <td data-label="Phạm vi">${g.ScopeType === 'ALL' ? 'Toàn bộ công ty' : 'Chỉ định công ty'}</td>
        <td data-label="Công ty được xem thêm">${g.ScopeType === 'ALL' ? '-' : (g.companies.map((c) => escapeHtml(c.companyName)).join(', ') || '-')}</td>
      </tr>`
    )
    .join('');
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
      await apiFetch('/access-groups', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Đã lưu nhóm quyền');
      accessGroupForm.reset();
      toggleGroupCompaniesField();
      renderGroupCompaniesCheckboxes();
      await loadAccessGroups();
    } catch (err) {
      showToast(err.message);
    }
  });
});

companyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    companyCode: document.getElementById('companyCode').value.trim(),
    companyName: document.getElementById('companyName').value.trim(),
    contactName: document.getElementById('companyContactName').value.trim(),
    contactPhone: document.getElementById('companyContactPhone').value.trim(),
    contactEmail: document.getElementById('companyContactEmail').value.trim(),
    address: document.getElementById('companyAddress').value.trim(),
    taxCode: document.getElementById('companyTaxCode').value.trim(),
    bankAccount: document.getElementById('companyBankAccount').value.trim(),
    bankName: document.getElementById('companyBankName').value.trim(),
  };

  await withSubmitLock(companyForm, async () => {
    try {
      await apiFetch('/companies', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Đã lưu công ty');
      companyForm.reset();
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
      await apiFetch('/redemption-units', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Đã lưu điểm tiêu');
      unitForm.reset();
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
