requireAuth();
renderTopbar('units');

const unitsBody = document.getElementById('unitsBody');
const locationSelect = document.getElementById('locationDetailId');
const unitForm = document.getElementById('unitForm');

loadLocations();
loadUnits();

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

async function loadUnits() {
  try {
    const data = await apiFetch('/redemption-units');
    if (!data.length) {
      unitsBody.innerHTML = '<tr><td colspan="5" style="color:#999;">Chua co don vi nao</td></tr>';
      return;
    }
    unitsBody.innerHTML = data
      .map(
        (u) => `
        <tr>
          <td>${escapeHtml(u.PartnerCode)}</td>
          <td>${escapeHtml(u.PartnerName)}</td>
          <td>${escapeHtml(u.LocationName || '-')}</td>
          <td>${escapeHtml(u.ContactName || '-')} ${u.ContactPhone ? '(' + escapeHtml(u.ContactPhone) + ')' : ''}</td>
          <td>${u.Status ? 'Hoat dong' : 'Ngung'}</td>
        </tr>`
      )
      .join('');
  } catch (err) {
    showToast(err.message);
  }
}

unitForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
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
    showToast('Da luu don vi thu hoi');
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
