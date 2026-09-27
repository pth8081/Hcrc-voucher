requireAuth();
renderTopbar('partner-api-keys');

const notAdminNotice = document.getElementById('notAdminNotice');
const keysCard = document.getElementById('keysCard');
const keysBody = document.getElementById('keysBody');
const keyUserId = document.getElementById('keyUserId');
const createKeyForm = document.getElementById('createKeyForm');
const newKeyPanel = document.getElementById('newKeyPanel');
const newKeyValue = document.getElementById('newKeyValue');

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function loadEligibleUsers() {
  const users = await apiFetch('/users?includeDeleted=false');
  // Chi tai khoan NHAN VIEN (role != 1, tuc khong phai quan tri) - khop dung rang buoc backend
  // (partnerApiKeyService.js tu choi tao key cho tai khoan quan tri).
  const eligible = users.filter((u) => Number(u.role) !== 1);
  keyUserId.innerHTML = eligible
    .map((u) => `<option value="${u.userId}">${escapeHtml(u.fullName || u.username)} (${escapeHtml(u.username)}) - ${escapeHtml(u.locationsDetail || 'chua gan diem tieu')}</option>`)
    .join('') || '<option value="">Khong co tai khoan nhan vien nao</option>';
}

function statusBadge(row) {
  if (row.revokedDate) return '<span class="status-badge status-used">DA THU HOI</span>';
  return '<span class="status-badge status-unused">DANG HOAT DONG</span>';
}

function scopesText(row) {
  const parts = [];
  if (row.canCheck) parts.push('check');
  if (row.canRedeem) parts.push('redeem');
  return parts.join(' + ') || '(khong co quyen nao)';
}

function renderKeys(rows) {
  if (!rows.length) {
    keysBody.innerHTML = '<tr><td colspan="8" class="text-muted">Chua co API key nao.</td></tr>';
    return;
  }
  keysBody.innerHTML = rows
    .map(
      (row) => `
    <tr>
      <td>${escapeHtml(row.label)}<div class="text-muted" style="font-size:12px;">${escapeHtml(row.keyPrefix)}...</div></td>
      <td>${escapeHtml(row.fullName || row.username)}<div class="text-muted" style="font-size:12px;">${escapeHtml(row.username)}</div></td>
      <td>${escapeHtml(row.locationsDetail || '-')}</td>
      <td>${scopesText(row)}</td>
      <td>${fmtDate(row.createdDate)}</td>
      <td>${fmtDate(row.lastUsedDate)}</td>
      <td>${statusBadge(row)}</td>
      <td>${row.revokedDate ? '' : `<button class="btn-secondary revoke-btn" data-id="${row.id}" type="button">Thu hoi</button>`}</td>
    </tr>`
    )
    .join('');

  keysBody.querySelectorAll('.revoke-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Thu hoi API key nay? Doi tac dang dung key nay se khong the goi API duoc nua.')) return;
      try {
        await apiFetch(`/partner-api-keys/${btn.dataset.id}`, { method: 'DELETE' });
        showToast('Da thu hoi API key');
        load();
      } catch (err) {
        showToast(err.message);
      }
    });
  });
}

async function load() {
  try {
    const [users, keys] = await Promise.all([loadEligibleUsers(), apiFetch('/partner-api-keys')]);
    renderKeys(keys);
  } catch (err) {
    notAdminNotice.classList.remove('hidden');
    keysCard.classList.add('hidden');
  }
}

createKeyForm.addEventListener('submit', (e) => {
  e.preventDefault();
  withSubmitLock(createKeyForm, async () => {
    try {
      const result = await apiFetch('/partner-api-keys', {
        method: 'POST',
        body: JSON.stringify({
          userId: Number(keyUserId.value),
          label: document.getElementById('keyLabel').value.trim(),
          canCheck: document.getElementById('keyCanCheck').checked,
          canRedeem: document.getElementById('keyCanRedeem').checked,
        }),
      });
      newKeyValue.value = result.apiKey;
      newKeyPanel.classList.remove('hidden');
      createKeyForm.reset();
      document.getElementById('keyCanCheck').checked = true;
      document.getElementById('keyCanRedeem').checked = true;
      showToast('Da tao API key - sao chep ngay, se khong hien lai');
      load();
    } catch (err) {
      showToast(err.message);
    }
  });
});

document.getElementById('copyNewKeyBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(newKeyValue.value);
    showToast('Da sao chep API key');
  } catch (err) {
    newKeyValue.select();
    showToast('Khong the tu dong sao chep - vui long chon va Ctrl+C thu cong');
  }
});

load();
