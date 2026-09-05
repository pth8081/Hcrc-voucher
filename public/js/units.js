requireAuth();
renderTopbar('units');

const unitsBody = document.getElementById('unitsBody');
const companiesBody = document.getElementById('companiesBody');
const locationSelect = document.getElementById('locationDetailId');
const companySelect = document.getElementById('companyId');
const unitForm = document.getElementById('unitForm');
const companyForm = document.getElementById('companyForm');

let companiesCache = [];

(async function init() {
  await Promise.all([loadLocations(), loadCompanies()]);
  await loadUnits();
})();

async function loadLocations() {
  try {
    const data = await apiFetch('/locations/details');
    locationSelect.innerHTML = data
      .map((d) => `<option value="${d.id}">${escapeHtml(d.LocationName)} (${escapeHtml(d.LocationCode)})</option>`)
      .join('');
  } catch (err) {
    showToast(err.message);
  }
}

async function loadCompanies() {
  try {
    companiesCache = await apiFetch('/companies');
    companySelect.innerHTML = companiesCache
      .map((c) => `<option value="${c.Id}">${escapeHtml(c.CompanyName)} (${escapeHtml(c.CompanyCode)})</option>`)
      .join('');
    renderCompanies();
  } catch (err) {
    showToast(err.message);
  }
}

function renderCompanies() {
  if (!companiesCache.length) {
    companiesBody.innerHTML = '<tr><td colspan="5" class="text-muted">Chua co cong ty nao</td></tr>';
    return;
  }
  companiesBody.innerHTML = companiesCache
    .map(
      (c) => `
      <tr>
        <td>${escapeHtml(c.CompanyCode)}</td>
        <td>${escapeHtml(c.CompanyName)}</td>
        <td>${escapeHtml(c.ContactName || '-')} ${c.ContactPhone ? '(' + escapeHtml(c.ContactPhone) + ')' : ''}</td>
        <td id="unit-count-${c.Id}">-</td>
        <td>${c.Status ? 'Hoat dong' : 'Ngung'}</td>
      </tr>`
    )
    .join('');
}

async function loadUnits() {
  try {
    const data = await apiFetch('/redemption-units');
    if (!data.length) {
      unitsBody.innerHTML = '<tr><td colspan="6" class="text-muted">Chua co diem tieu nao</td></tr>';
    } else {
      unitsBody.innerHTML = data
        .map(
          (u) => `
          <tr>
            <td>${escapeHtml(u.PartnerCode)}</td>
            <td>${escapeHtml(u.PartnerName)}</td>
            <td>${escapeHtml(u.CompanyName || '-')}</td>
            <td>${escapeHtml(u.LocationName || '-')}</td>
            <td>${escapeHtml(u.ContactName || '-')} ${u.ContactPhone ? '(' + escapeHtml(u.ContactPhone) + ')' : ''}</td>
            <td>${u.Status ? 'Hoat dong' : 'Ngung'}</td>
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

  try {
    await apiFetch('/companies', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Da luu cong ty');
    companyForm.reset();
    await loadCompanies();
    loadUnits();
  } catch (err) {
    showToast(err.message);
  }
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

  try {
    await apiFetch('/redemption-units', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Da luu diem tieu');
    unitForm.reset();
    loadUnits();
  } catch (err) {
    showToast(err.message);
  }
});

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
