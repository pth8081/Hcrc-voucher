requireAuth();
renderTopbar('connection');

let currentId = null; // null = dang tao ket noi moi
let defaults = null;

const el = (id) => document.getElementById(id);

init();

async function init() {
  el('f_authType').addEventListener('change', updateAuthFieldsVisibility);
  el('f_checkParamMode').addEventListener('change', updateCheckParamNameVisibility);
  el('f_redeemParamMode').addEventListener('change', updateRedeemParamNameVisibility);
  el('addCheckMapRow').addEventListener('click', () => addMapRow('checkStatusMapRows'));
  el('addRedeemMapRow').addEventListener('click', () => addMapRow('redeemStatusMapRows'));
  el('newBtn').addEventListener('click', () => resetForm());
  el('resetBtn').addEventListener('click', () => resetForm());
  el('saveBtn').addEventListener('click', () => save(false));
  el('saveActivateBtn').addEventListener('click', () => save(true));
  el('testCheckBtn').addEventListener('click', testCheck);
  el('testRedeemBtn').addEventListener('click', testRedeem);
  el('confirmRedeemCheck').addEventListener('change', (e) => {
    el('testRedeemBtn').disabled = !e.target.checked;
  });

  try {
    defaults = await apiFetch('/api-connections/defaults');
  } catch (err) {
    defaults = { checkMapping: {}, redeemMapping: {}, checkPath: '', redeemPath: '', redeemBodyTemplate: {} };
  }

  await loadList();
  resetForm();
}

async function loadList() {
  try {
    const list = await apiFetch('/api-connections');
    const wrap = el('connList');
    if (!list.length) {
      wrap.innerHTML = '<p style="color:#999;">Chua co ket noi nao, tao moi ben duoi.</p>';
      return;
    }
    wrap.innerHTML = list
      .map(
        (c) => `
        <div class="conn-row">
          <div>
            <strong>${escapeHtml(c.name)}</strong>${c.isActive ? '<span class="badge-active">DANG KICH HOAT</span>' : ''}
            <div class="hint" style="margin:2px 0 0;">${escapeHtml(c.baseUrl)}</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn-secondary" data-edit="${c.id}">Sua</button>
            ${!c.isActive ? `<button class="btn-secondary" data-activate="${c.id}">Kich hoat</button>` : ''}
            <button class="btn-danger" data-remove="${c.id}">Xoa</button>
          </div>
        </div>`
      )
      .join('');

    wrap.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => editConnection(Number(btn.dataset.edit)))
    );
    wrap.querySelectorAll('[data-activate]').forEach((btn) =>
      btn.addEventListener('click', () => activateConnection(Number(btn.dataset.activate)))
    );
    wrap.querySelectorAll('[data-remove]').forEach((btn) =>
      btn.addEventListener('click', () => removeConnection(Number(btn.dataset.remove)))
    );
  } catch (err) {
    showToast(err.message);
  }
}

async function activateConnection(id) {
  try {
    await apiFetch(`/api-connections/${id}/activate`, { method: 'POST' });
    showToast('Da kich hoat ket noi');
    await loadList();
  } catch (err) {
    showToast(err.message);
  }
}

async function removeConnection(id) {
  if (!confirm('Xoa ket noi nay? Khong the hoan tac.')) return;
  try {
    await apiFetch(`/api-connections/${id}`, { method: 'DELETE' });
    showToast('Da xoa ket noi');
    if (currentId === id) resetForm();
    await loadList();
  } catch (err) {
    showToast(err.message);
  }
}

async function editConnection(id) {
  try {
    const conn = await apiFetch(`/api-connections/${id}`);
    currentId = id;
    el('formTitle').textContent = `Sua ket noi: ${conn.name}`;
    populateForm(conn);
    window.scrollTo({ top: el('formTitle').offsetTop - 20, behavior: 'smooth' });
  } catch (err) {
    showToast(err.message);
  }
}

function resetForm() {
  currentId = null;
  el('formTitle').textContent = 'Tao ket noi moi';
  el('f_name').value = '';
  el('f_baseUrl').value = '';
  el('f_timeoutMs').value = 8000;
  el('f_authType').value = 'NONE';
  el('f_authToken_bearer').value = '';
  el('f_authToken_bearer').placeholder = 'Nhap token';
  el('f_apiKeyHeaderName').value = '';
  el('f_authToken_apikey').value = '';
  el('f_authToken_apikey').placeholder = 'Nhap API key';
  el('f_basicUsername').value = '';
  el('f_basicPassword').value = '';
  el('f_basicPassword').placeholder = 'Nhap password';

  el('f_checkMethod').value = 'GET';
  el('f_checkParamMode').value = 'PATH';
  el('f_checkPath').value = (defaults && defaults.checkPath) || '/api/vouchers/{code}/status';
  el('f_checkParamName').value = 'voucherCode';
  const cm = (defaults && defaults.checkMapping) || {};
  el('f_check_statusPath').value = cm.statusPath || 'status';
  el('f_check_foundPath').value = cm.foundPath || 'found';
  el('f_check_serialPath').value = cm.serialPath || 'serial';
  el('f_check_valueAmtPath').value = cm.valueAmtPath || 'valueAmt';
  el('f_check_issueDatePath').value = cm.issueDatePath || 'issueDate';
  el('f_check_expiryDatePath').value = cm.expiryDatePath || 'expiryDate';
  el('f_check_messagePath').value = cm.messagePath || 'message';
  setMapRows('checkStatusMapRows', cm.statusValueMap || { UNUSED: 'UNUSED', USED: 'USED', EXPIRED: 'EXPIRED', CANCELLED: 'CANCELLED' });

  el('f_redeemMethod').value = 'POST';
  el('f_redeemParamMode').value = 'BODY';
  el('f_redeemPath').value = (defaults && defaults.redeemPath) || '/api/vouchers/{code}/redeem';
  el('f_redeemParamName').value = 'voucherCode';
  el('f_redeemBodyTemplate').value = JSON.stringify((defaults && defaults.redeemBodyTemplate) || {}, null, 2);
  const rm = (defaults && defaults.redeemMapping) || {};
  el('f_redeem_successPath').value = rm.successPath || 'success';
  el('f_redeem_statusPath').value = rm.statusPath || 'status';
  el('f_redeem_transRefPath').value = rm.transRefPath || 'transRef';
  el('f_redeem_redeemedAtPath').value = rm.redeemedAtPath || 'redeemedAt';
  el('f_redeem_messagePath').value = rm.messagePath || 'message';
  setMapRows('redeemStatusMapRows', rm.statusValueMap || { REDEEMED: 'REDEEMED', USED: 'USED' });

  updateAuthFieldsVisibility();
  updateCheckParamNameVisibility();
  updateRedeemParamNameVisibility();
  el('testResultWrap').classList.add('hidden');
  el('confirmRedeemCheck').checked = false;
  el('testRedeemBtn').disabled = true;
}

function populateForm(conn) {
  el('f_name').value = conn.name || '';
  el('f_baseUrl').value = conn.baseUrl || '';
  el('f_timeoutMs').value = conn.timeoutMs || 8000;
  el('f_authType').value = conn.authType || 'NONE';
  el('f_authToken_bearer').value = '';
  el('f_authToken_bearer').placeholder = conn.hasAuthToken ? '(Da luu - de trong de giu nguyen)' : 'Nhap token';
  el('f_apiKeyHeaderName').value = conn.apiKeyHeaderName || '';
  el('f_authToken_apikey').value = '';
  el('f_authToken_apikey').placeholder = conn.hasAuthToken ? '(Da luu - de trong de giu nguyen)' : 'Nhap API key';
  el('f_basicUsername').value = conn.basicUsername || '';
  el('f_basicPassword').value = '';
  el('f_basicPassword').placeholder = conn.hasBasicPassword ? '(Da luu - de trong de giu nguyen)' : 'Nhap password';

  el('f_checkMethod').value = conn.checkMethod || 'GET';
  el('f_checkParamMode').value = conn.checkParamMode || 'PATH';
  el('f_checkPath').value = conn.checkPath || '';
  el('f_checkParamName').value = conn.checkParamName || 'voucherCode';
  const cm = conn.checkMapping || {};
  el('f_check_statusPath').value = cm.statusPath || '';
  el('f_check_foundPath').value = cm.foundPath || '';
  el('f_check_serialPath').value = cm.serialPath || '';
  el('f_check_valueAmtPath').value = cm.valueAmtPath || '';
  el('f_check_issueDatePath').value = cm.issueDatePath || '';
  el('f_check_expiryDatePath').value = cm.expiryDatePath || '';
  el('f_check_messagePath').value = cm.messagePath || '';
  setMapRows('checkStatusMapRows', cm.statusValueMap || {});

  el('f_redeemMethod').value = conn.redeemMethod || 'POST';
  el('f_redeemParamMode').value = conn.redeemParamMode || 'BODY';
  el('f_redeemPath').value = conn.redeemPath || '';
  el('f_redeemParamName').value = conn.redeemParamName || 'voucherCode';
  el('f_redeemBodyTemplate').value = conn.redeemBodyTemplate ? JSON.stringify(conn.redeemBodyTemplate, null, 2) : '';
  const rm = conn.redeemMapping || {};
  el('f_redeem_successPath').value = rm.successPath || '';
  el('f_redeem_statusPath').value = rm.statusPath || '';
  el('f_redeem_transRefPath').value = rm.transRefPath || '';
  el('f_redeem_redeemedAtPath').value = rm.redeemedAtPath || '';
  el('f_redeem_messagePath').value = rm.messagePath || '';
  setMapRows('redeemStatusMapRows', rm.statusValueMap || {});

  updateAuthFieldsVisibility();
  updateCheckParamNameVisibility();
  updateRedeemParamNameVisibility();
  el('testResultWrap').classList.add('hidden');
  el('confirmRedeemCheck').checked = false;
  el('testRedeemBtn').disabled = true;
}

function updateAuthFieldsVisibility() {
  const type = el('f_authType').value;
  document.querySelectorAll('.authFields').forEach((div) => div.classList.add('hidden'));
  if (type !== 'NONE') {
    const target = el(`authFields_${type}`);
    if (target) target.classList.remove('hidden');
  }
}

function updateCheckParamNameVisibility() {
  const mode = el('f_checkParamMode').value;
  el('checkParamNameWrap').classList.toggle('hidden', mode === 'PATH');
}

function updateRedeemParamNameVisibility() {
  const mode = el('f_redeemParamMode').value;
  el('redeemParamNameWrap').classList.toggle('hidden', mode !== 'QUERY');
}

function addMapRow(containerId, rawKey = '', mappedValue = '') {
  const container = el(containerId);
  const row = document.createElement('div');
  row.className = 'maprow';
  row.innerHTML = `
    <input placeholder="Gia tri Core API tra ve (vd: 0)" class="mk" value="${escapeHtml(rawKey)}" />
    <input placeholder="Trang thai chuan (vd: UNUSED)" class="mv" value="${escapeHtml(mappedValue)}" />
    <button type="button" class="btn-secondary">Xoa</button>
  `;
  row.querySelector('button').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function setMapRows(containerId, obj) {
  const container = el(containerId);
  container.innerHTML = '';
  Object.entries(obj || {}).forEach(([k, v]) => addMapRow(containerId, k, v));
}

function getMapRows(containerId) {
  const result = {};
  el(containerId)
    .querySelectorAll('.maprow')
    .forEach((row) => {
      const k = row.querySelector('.mk').value.trim();
      const v = row.querySelector('.mv').value.trim();
      if (k && v) result[k] = v;
    });
  return result;
}

function readAuthTokenField() {
  const type = el('f_authType').value;
  if (type === 'BEARER') return el('f_authToken_bearer').value;
  if (type === 'API_KEY_HEADER') return el('f_authToken_apikey').value;
  return '';
}

function collectFormData() {
  let redeemBodyTemplate = null;
  const raw = el('f_redeemBodyTemplate').value.trim();
  if (raw) {
    try {
      redeemBodyTemplate = JSON.parse(raw);
    } catch (err) {
      throw new Error('Body template (Redeem) khong phai JSON hop le: ' + err.message);
    }
  }

  return {
    name: el('f_name').value.trim(),
    baseUrl: el('f_baseUrl').value.trim(),
    timeoutMs: Number(el('f_timeoutMs').value) || 8000,
    authType: el('f_authType').value,
    authToken: readAuthTokenField(),
    apiKeyHeaderName: el('f_apiKeyHeaderName').value.trim(),
    basicUsername: el('f_basicUsername').value.trim(),
    basicPassword: el('f_basicPassword').value,

    checkMethod: el('f_checkMethod').value,
    checkPath: el('f_checkPath').value.trim(),
    checkParamMode: el('f_checkParamMode').value,
    checkParamName: el('f_checkParamName').value.trim(),
    checkMapping: {
      statusPath: el('f_check_statusPath').value.trim(),
      foundPath: el('f_check_foundPath').value.trim() || undefined,
      serialPath: el('f_check_serialPath').value.trim() || undefined,
      valueAmtPath: el('f_check_valueAmtPath').value.trim() || undefined,
      issueDatePath: el('f_check_issueDatePath').value.trim() || undefined,
      expiryDatePath: el('f_check_expiryDatePath').value.trim() || undefined,
      messagePath: el('f_check_messagePath').value.trim() || undefined,
      statusValueMap: getMapRows('checkStatusMapRows'),
    },

    redeemMethod: el('f_redeemMethod').value,
    redeemPath: el('f_redeemPath').value.trim(),
    redeemParamMode: el('f_redeemParamMode').value,
    redeemParamName: el('f_redeemParamName').value.trim(),
    redeemBodyTemplate,
    redeemMapping: {
      successPath: el('f_redeem_successPath').value.trim(),
      statusPath: el('f_redeem_statusPath').value.trim() || undefined,
      transRefPath: el('f_redeem_transRefPath').value.trim() || undefined,
      redeemedAtPath: el('f_redeem_redeemedAtPath').value.trim() || undefined,
      messagePath: el('f_redeem_messagePath').value.trim() || undefined,
      statusValueMap: getMapRows('redeemStatusMapRows'),
    },
  };
}

async function save(activateAfter) {
  let payload;
  try {
    payload = collectFormData();
  } catch (err) {
    showToast(err.message);
    return;
  }
  if (!payload.name || !payload.baseUrl || !payload.checkPath || !payload.redeemPath) {
    showToast('Vui long nhap Ten, Base URL, Path kiem tra va Path thu hoi');
    return;
  }

  try {
    let id = currentId;
    if (id) {
      await apiFetch(`/api-connections/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      const created = await apiFetch('/api-connections', { method: 'POST', body: JSON.stringify(payload) });
      id = created.id;
      currentId = id;
    }
    if (activateAfter) {
      await apiFetch(`/api-connections/${id}/activate`, { method: 'POST' });
    }
    showToast(activateAfter ? 'Da luu va kich hoat ket noi' : 'Da luu ket noi');
    await loadList();
  } catch (err) {
    showToast(err.message);
  }
}

async function testCheck() {
  const voucherCode = el('testVoucherCode').value.trim();
  if (!voucherCode) return showToast('Nhap ma voucher de test');

  let connection;
  try {
    connection = collectFormData();
  } catch (err) {
    return showToast(err.message);
  }

  const body = { voucherCode, connection };
  if (currentId) body.connectionId = currentId;

  el('testCheckBtn').disabled = true;
  try {
    const data = await apiFetch('/api-connections/test-check', { method: 'POST', body: JSON.stringify(body) });
    renderTestResult(data);
  } catch (err) {
    showToast(err.message);
  } finally {
    el('testCheckBtn').disabled = false;
  }
}

async function testRedeem() {
  const voucherCode = el('testVoucherCode').value.trim();
  if (!voucherCode) return showToast('Nhap ma voucher de test');
  if (!el('confirmRedeemCheck').checked) return showToast('Ban can xac nhan hieu ro rui ro truoc khi test thu hoi');
  if (!confirm(`Ban chac chan muon TIEU THAT voucher "${voucherCode}" tren he thong Core?`)) return;

  let connection;
  try {
    connection = collectFormData();
  } catch (err) {
    return showToast(err.message);
  }

  const body = { voucherCode, connection, confirmRedeem: true };
  if (currentId) body.connectionId = currentId;

  el('testRedeemBtn').disabled = true;
  try {
    const data = await apiFetch('/api-connections/test-redeem', { method: 'POST', body: JSON.stringify(body) });
    renderTestResult(data);
  } catch (err) {
    showToast(err.message);
  } finally {
    el('testRedeemBtn').disabled = false;
  }
}

function renderTestResult(data) {
  el('testResultWrap').classList.remove('hidden');
  el('testMeta').textContent = `HTTP ${data.httpStatus ?? '-'} - ${data.latencyMs ?? '-'} ms - ${data.requestUrl || ''}`;

  const n = data.normalized || {};
  el('testNormalized').innerHTML = `
    <div class="info-row"><span class="k">Trang thai chuan hoa</span><span class="v">${escapeHtml(n.status || '-')}</span></div>
    ${n.found !== undefined ? `<div class="info-row"><span class="k">found</span><span class="v">${n.found}</span></div>` : ''}
    ${n.voucherSerial ? `<div class="info-row"><span class="k">So serial</span><span class="v">${escapeHtml(n.voucherSerial)}</span></div>` : ''}
    ${n.valueAmt != null ? `<div class="info-row"><span class="k">Menh gia</span><span class="v">${fmtMoney(n.valueAmt)}</span></div>` : ''}
    ${n.issueDate ? `<div class="info-row"><span class="k">Ngay cap</span><span class="v">${fmtDate(n.issueDate)}</span></div>` : ''}
    ${n.expiryDate ? `<div class="info-row"><span class="k">Han su dung</span><span class="v">${fmtDate(n.expiryDate)}</span></div>` : ''}
    ${n.success !== undefined ? `<div class="info-row"><span class="k">success</span><span class="v">${n.success}</span></div>` : ''}
    ${n.transRef ? `<div class="info-row"><span class="k">Ma giao dich (transRef)</span><span class="v">${escapeHtml(n.transRef)}</span></div>` : ''}
    ${n.message ? `<div class="info-row"><span class="k">Thong bao</span><span class="v">${escapeHtml(n.message)}</span></div>` : ''}
  `;
  el('testRaw').textContent = JSON.stringify(data.raw, null, 2);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
