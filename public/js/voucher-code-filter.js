requireAuth();
renderTopbar('voucher-code-filter');

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const noAccessNotice = document.getElementById('noAccessNotice');
const mainCard = document.getElementById('mainCard');
const systemsWrap = document.getElementById('systemsWrap');

init();

async function init() {
  let systems;
  try {
    systems = await apiFetch('/voucher-code-filter');
  } catch (err) {
    noAccessNotice.classList.remove('hidden');
    mainCard.classList.add('hidden');
    return;
  }
  renderSystems(systems);
}

function renderSystems(systems) {
  if (!systems.length) {
    systemsWrap.innerHTML = '<div class="card"><p class="text-muted m-0">Chưa có hệ thống voucher nào được gán cho tài khoản của bạn.</p></div>';
    return;
  }
  systemsWrap.innerHTML = systems.map((s) => systemCardHtml(s)).join('');
  systems.forEach((s) => wireCard(s));
}

function systemCardHtml(s) {
  return `
    <div class="card" data-system-id="${s.id}">
      <div class="flex items-center gap-8" style="justify-content:space-between;">
        <h3 style="margin:0;">${escapeHtml(s.name)}${s.isActive ? '<span class="badge-active">ĐANG KÍCH HOẠT</span>' : ''}${s.isLocked ? '<span class="badge-locked">ĐÃ KHÓA</span>' : ''}</h3>
      </div>

      <label class="flex items-center gap-8 fw-normal mb-8 mt-14">
        <input type="radio" name="mode_${s.id}" class="checkbox-input mode-exclude" value="EXCLUDE" ${s.codePrefixFilterMode === 'EXCLUDE' ? 'checked' : ''} />
        <span><strong>Loại trừ (blacklist)</strong> — mã trùng tiền tố liệt kê sẽ <strong>KHÔNG</strong> quét/thu hồi được, còn lại quét bình thường.</span>
      </label>
      <label class="flex items-center gap-8 fw-normal mb-8">
        <input type="radio" name="mode_${s.id}" class="checkbox-input mode-include" value="INCLUDE" ${s.codePrefixFilterMode === 'INCLUDE' ? 'checked' : ''} />
        <span><strong>Chỉ chấp nhận (whitelist)</strong> — <strong>CHỈ</strong> mã trùng tiền tố liệt kê mới quét/thu hồi được, còn lại bị từ chối.</span>
      </label>

      <div class="exclude-fields" ${s.codePrefixFilterMode === 'INCLUDE' ? 'style="display:none"' : ''}>
        <label>Các tiền tố BỊ LOẠI TRỪ (cách nhau bằng dấu phẩy, để trống = không loại trừ gì)</label>
        <input class="excluded-input" value="${escapeHtml(s.excludedCodePrefixes.join(', '))}" placeholder="VD: C, TEST, X9" />
      </div>
      <div class="include-fields" ${s.codePrefixFilterMode === 'EXCLUDE' ? 'style="display:none"' : ''}>
        <label>Các tiền tố ĐƯỢC CHẤP NHẬN (cách nhau bằng dấu phẩy, bắt buộc có ít nhất 1 tiền tố)</label>
        <input class="allowed-input" value="${escapeHtml(s.allowedCodePrefixes.join(', '))}" placeholder="VD: FJ, CVA" />
      </div>

      <div class="flex gap-10 mt-16">
        <button class="btn-primary save-btn">Lưu thay đổi</button>
      </div>
    </div>
  `;
}

function wireCard(system) {
  const card = document.querySelector(`.card[data-system-id="${system.id}"]`);
  const excludeRadio = card.querySelector('.mode-exclude');
  const includeRadio = card.querySelector('.mode-include');
  const excludeFields = card.querySelector('.exclude-fields');
  const includeFields = card.querySelector('.include-fields');
  const excludedInput = card.querySelector('.excluded-input');
  const allowedInput = card.querySelector('.allowed-input');
  const saveBtn = card.querySelector('.save-btn');

  function updateModeVisibility() {
    excludeFields.style.display = includeRadio.checked ? 'none' : '';
    includeFields.style.display = includeRadio.checked ? '' : 'none';
  }
  excludeRadio.addEventListener('change', updateModeVisibility);
  includeRadio.addEventListener('change', updateModeVisibility);

  saveBtn.addEventListener('click', async () => {
    const codePrefixFilterMode = includeRadio.checked ? 'INCLUDE' : 'EXCLUDE';
    const allowedCodePrefixes = allowedInput.value.trim() || null;
    if (codePrefixFilterMode === 'INCLUDE' && !allowedCodePrefixes) {
      showToast('Đã chọn "Chỉ chấp nhận tiền tố" nhưng chưa nhập tiền tố nào - vui lòng nhập ít nhất 1 tiền tố được chấp nhận.');
      return;
    }
    saveBtn.disabled = true;
    try {
      await apiFetch(`/voucher-code-filter/${encodeURIComponent(system.id)}`, {
        method: 'PUT',
        body: JSON.stringify({
          codePrefixFilterMode,
          excludedCodePrefixes: excludedInput.value.trim() || null,
          allowedCodePrefixes,
        }),
      });
      showToast(`Đã lưu cấu hình lọc mã cho "${system.name}"`);
    } catch (err) {
      showToast(err.message);
    } finally {
      saveBtn.disabled = false;
    }
  });
}
