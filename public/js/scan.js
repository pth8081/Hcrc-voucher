requireAuth();
renderTopbar('scan');

const voucherInput = document.getElementById('voucherInput');
const cameraBtn = document.getElementById('cameraBtn');
const qrReaderEl = document.getElementById('qr-reader');
const scanHero = document.getElementById('scanHero');
const scanInputGroup = document.getElementById('scanInputGroup');
const resultCard = document.getElementById('resultCard');
const statusBadge = document.getElementById('statusBadge');
const resultInfo = document.getElementById('resultInfo');
const resultActions = document.getElementById('resultActions');
const recentBody = document.getElementById('recentBody');
const manualBlockedHint = document.getElementById('manualBlockedHint');
const systemSwitchCard = document.getElementById('systemSwitchCard');
const systemSwitch = document.getElementById('systemSwitch');
const systemActiveBanner = document.getElementById('systemActiveBanner');
const systemActiveBannerText = document.getElementById('systemActiveBannerText');
const confirmRedeemOverlay = document.getElementById('confirmRedeemOverlay');
const confirmRedeemTitle = document.getElementById('confirmRedeemTitle');
const confirmRedeemSub = document.getElementById('confirmRedeemSub');
const confirmRedeemSubBatch = document.getElementById('confirmRedeemSubBatch');
const confirmRedeemCode = document.getElementById('confirmRedeemCode');
const confirmRedeemAmount = document.getElementById('confirmRedeemAmount');
const confirmRedeemSystem = document.getElementById('confirmRedeemSystem');
const confirmBatchCount = document.getElementById('confirmBatchCount');
const confirmBatchAmount = document.getElementById('confirmBatchAmount');
const confirmBatchSystem = document.getElementById('confirmBatchSystem');
const confirmRedeemYesBtn = document.getElementById('confirmRedeemYesBtn');
const confirmRedeemNoBtn = document.getElementById('confirmRedeemNoBtn');

// Che do quet (v3.75 - "Quet nhieu, thu hoi 1 lan"): SINGLE (mac dinh, hanh vi cu nguyen ven -
// quet 1 ma, xac nhan thu hoi ngay) hoac BATCH (quet nhieu ma lien tiep vao 1 danh sach tam,
// CHUA goi thu hoi gi ca - chi bam "Thu hoi tat ca" cuoi cung moi thuc su goi API thu hoi, xem
// README muc 19). 2 che do dung CHUNG 1 o quet/camera, chi khac nhau o cach xu ly SAU buoc kiem
// tra (CHECK) - xem runCheck() ben duoi.
const scanModeSwitch = document.getElementById('scanModeSwitch');
const scanModeHint = document.getElementById('scanModeHint');
const scanHeroTitle = document.getElementById('scanHeroTitle');
const scanHeroHint = document.getElementById('scanHeroHint');
const batchListCard = document.getElementById('batchListCard');
const batchList = document.getElementById('batchList');
const batchTotal = document.getElementById('batchTotal');
const batchRedeemAllBtn = document.getElementById('batchRedeemAllBtn');
const batchClearBtn = document.getElementById('batchClearBtn');
const batchResultCard = document.getElementById('batchResultCard');
const batchSummaryGrid = document.getElementById('batchSummaryGrid');
const batchResultList = document.getElementById('batchResultList');
const batchGrandTotal = document.getElementById('batchGrandTotal');
const batchContinueBtn = document.getElementById('batchContinueBtn');

const MAX_BATCH_SIZE = 20; // khop voi gioi han server (voucherService.js#MAX_BATCH_SIZE)
let scanMode = 'SINGLE';
let batchItems = []; // { voucherCode, valueAmt, voucherSerial }
let pendingConfirmIsBatch = false;

// Chi chap nhan du lieu quet (may quet HID hoac camera), khong cho phep go tay/dan/keo-tha.
// May quet HID gia lap ban phim that nen khong the chan bang thuoc tinh readonly - thay vao do
// phat hien qua TOC DO go phim: may quet dua ky tu ve gan nhu tuc thi (vai ms/ky tu), trong khi
// nguoi go tay nhanh nhat cung mat toi thieu vai chuc ms/ky tu.
const SCAN_MIN_LENGTH = 4;
const SCAN_MAX_MS_PER_CHAR = 40;
let keyTimestamps = [];

let lastScanMethod = 'HID_SCANNER';
let html5QrCode = null;
let cameraRunning = false;
let recentRows = [];

// He thong voucher dang chon (vd BRGmart/Fuji, khi tich hop nhieu he thong qua man hinh "Ket
// noi API") - id null nghia la dung ket noi active mac dinh cua server (hanh vi cu, khong doi gi
// khi chi co 1 he thong duoc cau hinh). KHONG luu lai giua cac lan mo trang (khong dung
// localStorage) - moi lan vao trang Quet voucher LUON mac dinh ve he thong active, tranh truong
// hop ca truoc de quen o 1 he thong khac roi ca sau quet nham sang he thong do.
let selectedConnectionId = null;
let selectedConnectionName = null;

focusInput();
loadSystemOptions();

scanModeSwitch.querySelectorAll('[data-mode]').forEach((btn) => {
  btn.addEventListener('click', () => setScanMode(btn.dataset.mode));
});
batchClearBtn.addEventListener('click', clearBatchList);
batchRedeemAllBtn.addEventListener('click', openBatchRedeemConfirm);
batchContinueBtn.addEventListener('click', () => {
  batchItems = [];
  renderBatchList();
  batchResultCard.classList.add('hidden');
  focusInput();
});

/** Doi che do quet (SINGLE/BATCH) - luon don ve trang thai "san sang quet" sach se, khong giu
 * lai ket qua/danh sach dang do cua che do truoc do (tranh nham lan 2 luong voi nhau). */
function setScanMode(mode) {
  if (mode === scanMode) return;
  scanMode = mode;

  scanModeSwitch.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.classList.toggle('selected-default', btn.dataset.mode === mode);
  });

  resultCard.classList.add('hidden');
  batchListCard.classList.add('hidden');
  batchResultCard.classList.add('hidden');
  batchItems = [];

  if (mode === 'BATCH') {
    scanModeHint.textContent = 'Quét nhiều mã liên tiếp vào 1 danh sách, xem lại/bớt mã rồi mới bấm "Thu hồi tất cả" 1 lần.';
    scanHeroTitle.textContent = 'Sẵn sàng quét (nhiều voucher)';
    scanHeroHint.innerHTML = 'Quét <strong>từng mã một</strong> - mỗi mã quét xong sẽ tự thêm vào danh sách bên dưới, <strong>chưa thu hồi ngay</strong>. Quét xong hết thì xem lại danh sách rồi mới bấm "Thu hồi tất cả".';
    batchListCard.classList.remove('hidden');
    renderBatchList();
  } else {
    scanModeHint.textContent = 'Quét 1 mã, xác nhận thu hồi ngay rồi mới được quét mã tiếp theo.';
    scanHeroTitle.textContent = 'Sẵn sàng quét voucher';
    scanHeroHint.innerHTML = 'Chỉ chấp nhận mã được <strong>quét</strong> bằng máy quét mã vạch/QR hoặc camera — không cho phép gõ tay để tránh nhập sai hoặc gian lận.';
  }
  focusInput();
}

async function loadSystemOptions() {
  try {
    const systems = await apiFetch('/vouchers/systems');
    if (!systems.length) return; // chi 1 he thong duy nhat (hoac chua cau hinh ket noi nao) -> an o chon, giu nguyen hanh vi cu
    const defaultSystem = systems.find((s) => s.isActive) || systems[0];
    selectedConnectionId = defaultSystem.id;
    selectedConnectionName = defaultSystem.name;

    if (systems.length > 1) {
      systemSwitchCard.classList.remove('hidden');
      renderSystemSwitch(systems, defaultSystem.id);
    }
  } catch (err) {
    // Khong chan luong quet neu loi o cho nay (vd mang cham) - chi khong hien o chon, van dung
    // dung ket noi active mac dinh cua server y het hanh vi cu (selectedConnectionId = null).
    // eslint-disable-next-line no-console
    console.error('Không tải được danh sách hệ thống voucher:', err.message);
  }
}

function renderSystemSwitch(systems, defaultId) {
  systemSwitch.innerHTML = systems
    .map((s) => `<button type="button" class="system-btn" data-id="${s.id}" data-name="${escapeHtml(s.name)}">${escapeHtml(s.name)}</button>`)
    .join('');
  systemSwitch.querySelectorAll('.system-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedConnectionId = Number(btn.dataset.id);
      selectedConnectionName = btn.dataset.name;
      updateSystemSwitchUi(defaultId);
    });
  });
  updateSystemSwitchUi(defaultId);
}

function updateSystemSwitchUi(defaultId) {
  const isDefault = selectedConnectionId === defaultId;
  systemSwitch.querySelectorAll('.system-btn').forEach((btn) => {
    const isSelected = Number(btn.dataset.id) === selectedConnectionId;
    btn.classList.toggle('selected-default', isSelected && isDefault);
    btn.classList.toggle('selected-alt', isSelected && !isDefault);
  });
  systemActiveBanner.className = 'system-active-banner ' + (isDefault ? 'default' : 'alt');
  systemActiveBannerText.textContent = `Đang quét cho: Hệ thống voucher ${selectedConnectionName}`;
}

voucherInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleScanSubmit();
    return;
  }
  if (e.key.length === 1) {
    keyTimestamps.push(Date.now());
  }
});

voucherInput.addEventListener('paste', (e) => {
  e.preventDefault();
  rejectManualEntry();
});

voucherInput.addEventListener('drop', (e) => {
  e.preventDefault();
  rejectManualEntry();
});

cameraBtn.addEventListener('click', toggleCamera);

function focusInput() {
  voucherInput.value = '';
  keyTimestamps = [];
  voucherInput.focus();
}

function handleScanSubmit() {
  const value = voucherInput.value.trim();
  const timestamps = keyTimestamps;
  keyTimestamps = [];
  if (!value) return;

  if (!looksLikeGenuineScan(value, timestamps)) {
    rejectManualEntry();
    return;
  }

  hideManualBlockedHint();
  lastScanMethod = 'HID_SCANNER';
  runCheck(value);
}

/** Doan tin hieu quet that (nhanh, deu) khac voi go tay (cham, khong deu). */
function looksLikeGenuineScan(value, timestamps) {
  if (value.length < SCAN_MIN_LENGTH) return false;
  if (timestamps.length < value.length) return false; // co ky tu khong qua keydown (vd dan)
  if (timestamps.length <= 1) return true;
  const elapsed = timestamps[timestamps.length - 1] - timestamps[0];
  const maxAllowed = (timestamps.length - 1) * SCAN_MAX_MS_PER_CHAR;
  return elapsed <= maxAllowed;
}

function rejectManualEntry() {
  focusInput();
  manualBlockedHint.classList.remove('hidden');
  showToast('Không cho phép nhập tay mã voucher, vui lòng dùng máy quét hoặc camera');
  clearTimeout(rejectManualEntry._timer);
  rejectManualEntry._timer = setTimeout(() => manualBlockedHint.classList.add('hidden'), 4000);
}

function hideManualBlockedHint() {
  manualBlockedHint.classList.add('hidden');
}

async function runCheck(voucherCode) {
  try {
    voucherInput.disabled = true;
    cameraBtn.disabled = true;
    const data = await apiFetch('/vouchers/check', {
      method: 'POST',
      body: JSON.stringify({ voucherCode, scanMethod: lastScanMethod, connectionId: selectedConnectionId }),
    });
    if (scanMode === 'BATCH') {
      addToBatchList(voucherCode, data);
      focusInput();
    } else {
      renderResult(voucherCode, data);
    }
  } catch (err) {
    showToast(err.message);
    focusInput();
  } finally {
    voucherInput.disabled = false;
    cameraBtn.disabled = false;
  }
}

function renderResult(voucherCode, data) {
  resultCard.classList.remove('hidden');
  resultActions.innerHTML = '';

  if (data.status === 'UNUSED' && data.canRedeem) {
    statusBadge.innerHTML = '<span class="status-badge status-unused">CHƯA SỬ DỤNG</span>';
    resultInfo.innerHTML = `
      <div class="info-row"><span class="k">Mã voucher</span><span class="v">${escapeHtml(voucherCode)}</span></div>
      <div class="info-row"><span class="k">Số serial</span><span class="v">${escapeHtml(data.voucherSerial || '-')}</span></div>
      <div class="info-row"><span class="k">Mệnh giá</span><span class="v">${fmtMoney(data.valueAmt)}</span></div>
      <div class="info-row"><span class="k">Ngày cấp</span><span class="v">${escapeHtml(fmtDate(data.issueDate))}</span></div>
      <div class="info-row"><span class="k">Hạn sử dụng</span><span class="v">${escapeHtml(fmtDate(data.expiryDate))}</span></div>
    `;
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn-success';
    confirmBtn.textContent = 'Xác nhận thu hồi';
    confirmBtn.addEventListener('click', () => openRedeemConfirm(voucherCode, data));

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-secondary';
    cancelBtn.textContent = 'Hủy / Quét mã khác';
    cancelBtn.addEventListener('click', resetResult);

    resultActions.appendChild(confirmBtn);
    resultActions.appendChild(cancelBtn);
  } else if (data.status === 'USED') {
    statusBadge.innerHTML = '<span class="status-badge status-used">ĐÃ SỬ DỤNG</span>';
    resultInfo.innerHTML = `<p>${escapeHtml(data.message || 'Voucher này đã được sử dụng. Vui lòng quét mã voucher khác.')}</p>`;
    addContinueButton();
  } else {
    statusBadge.innerHTML = '<span class="status-badge status-other">KHÔNG HỢP LỆ</span>';
    resultInfo.innerHTML = `<p>${escapeHtml(data.message || 'Voucher không tồn tại hoặc không hợp lệ.')}</p>`;
    addContinueButton();
  }
}

function addContinueButton() {
  const btn = document.createElement('button');
  btn.className = 'btn-secondary';
  btn.textContent = 'Quét mã khác';
  btn.addEventListener('click', resetResult);
  resultActions.appendChild(btn);
}

// Them 1 buoc xac nhan nua truoc khi goi API thu hoi that su, tranh bam nham/cham nham ngay
// sau khi kiem tra xong (nhat la tren dien thoai, man hinh cam ung) - theo yeu cau nguoi dung.
// Khong thay doi gi logic goi API/ghi du lieu, chi chen them 1 buoc hoi lai o phia giao dien.
let pendingRedeemVoucherCode = null;

function openRedeemConfirm(voucherCode, data) {
  pendingRedeemVoucherCode = voucherCode;
  pendingConfirmIsBatch = false;
  confirmRedeemTitle.textContent = 'Bạn có muốn thu hồi voucher này không?';
  confirmRedeemSub.classList.remove('hidden');
  confirmRedeemSubBatch.classList.add('hidden');
  confirmRedeemCode.textContent = voucherCode;
  confirmRedeemAmount.textContent = fmtMoney(data.valueAmt);
  confirmRedeemSystem.textContent = selectedConnectionName || 'mặc định';
  confirmRedeemOverlay.classList.remove('hidden');
  resultActions.querySelectorAll('button').forEach((b) => (b.disabled = true));
}

function closeRedeemConfirm() {
  confirmRedeemOverlay.classList.add('hidden');
  pendingRedeemVoucherCode = null;
  if (!pendingConfirmIsBatch) {
    resultActions.querySelectorAll('button').forEach((b) => (b.disabled = false));
  }
  pendingConfirmIsBatch = false;
}

confirmRedeemYesBtn.addEventListener('click', () => {
  const isBatch = pendingConfirmIsBatch;
  const voucherCode = pendingRedeemVoucherCode;
  closeRedeemConfirm();
  if (isBatch) {
    confirmBatchRedeem();
  } else if (voucherCode) {
    confirmRedeem(voucherCode);
  }
});

confirmRedeemNoBtn.addEventListener('click', () => {
  // "Khong" -> thoat ve man hinh scan san sang - he thong (BRGmart/Fuji) DANG CHON van giu
  // nguyen, khong reset lai (selectedConnectionId/Name khong bi dong cham o day). Che do BATCH:
  // chi dong hop thoai, GIU NGUYEN danh sach dang cho (nguoi dung co the quet them/bo bot roi
  // bam lai "Thu hoi tat ca" sau).
  const isBatch = pendingConfirmIsBatch;
  closeRedeemConfirm();
  if (!isBatch) resetResult();
});

async function confirmRedeem(voucherCode) {
  try {
    const buttons = resultActions.querySelectorAll('button');
    buttons.forEach((b) => (b.disabled = true));

    const data = await apiFetch('/vouchers/redeem', {
      method: 'POST',
      body: JSON.stringify({ voucherCode, scanMethod: lastScanMethod, connectionId: selectedConnectionId }),
    });

    if (data.success) {
      const msg = data.pendingSync
        ? `Đã thu hồi: ${voucherCode} (đang chờ đồng bộ với hệ thống trung tâm)`
        : `Thu hồi thành công: ${voucherCode}`;
      showToast(msg);
      addRecentRow({
        time: new Date(),
        voucherCode,
        connectionName: data.connectionName || selectedConnectionName,
        valueAmt: data.valueAmt,
        transNum: data.transNum,
        pendingSync: data.pendingSync,
      });
      resetResult();
    } else {
      showToast(data.message || 'Thu hồi thất bại');
      resetResult();
    }
  } catch (err) {
    showToast(err.message);
    resetResult();
  }
}

function resetResult() {
  resultCard.classList.add('hidden');
  statusBadge.innerHTML = '';
  resultInfo.innerHTML = '';
  resultActions.innerHTML = '';
  focusInput();
}

// ===== Che do "Quet nhieu" (v3.75) =====

/** Sau buoc CHECK (chua thu hoi gi) khi dang o che do BATCH: hop le thi them vao danh sach tam,
 * khong hop le (da dung/het han/loai tru...) thi bao loi va KHONG them - nguoi dung quet tiep
 * ngay, khong can thao tac gi them cho ma loi do. */
function addToBatchList(voucherCode, data) {
  if (batchItems.some((it) => it.voucherCode === voucherCode)) {
    showToast(`Mã ${voucherCode} đã có trong danh sách, không thêm trùng.`);
    return;
  }
  if (batchItems.length >= MAX_BATCH_SIZE) {
    showToast(`Danh sách đã đủ tối đa ${MAX_BATCH_SIZE} voucher - vui lòng bấm "Thu hồi tất cả" trước khi quét thêm.`);
    return;
  }
  if (!(data.status === 'UNUSED' && data.canRedeem)) {
    showToast(data.message || 'Voucher này không hợp lệ để thu hồi.');
    return;
  }
  batchItems.push({ voucherCode, valueAmt: data.valueAmt, voucherSerial: data.voucherSerial });
  renderBatchList();
  showToast(`Đã thêm ${voucherCode} vào danh sách (${batchItems.length} voucher)`);
}

function removeBatchItem(voucherCode) {
  batchItems = batchItems.filter((it) => it.voucherCode !== voucherCode);
  renderBatchList();
}

function clearBatchList() {
  if (!batchItems.length) return;
  if (!confirm('Xóa toàn bộ danh sách đang chờ thu hồi?')) return;
  batchItems = [];
  renderBatchList();
  focusInput();
}

function renderBatchList() {
  if (!batchItems.length) {
    batchList.innerHTML = '<p class="text-muted">Chưa quét voucher nào. Quét mã để thêm vào danh sách.</p>';
    batchTotal.classList.add('hidden');
    batchRedeemAllBtn.textContent = 'Thu hồi tất cả';
    batchRedeemAllBtn.disabled = true;
    return;
  }

  batchList.innerHTML = batchItems
    .map(
      (it) => `
    <div class="batch-row">
      <div class="batch-row-main">
        <span class="batch-row-code">${escapeHtml(it.voucherCode)}</span>
        <span class="batch-row-amt">Chưa sử dụng — mệnh giá ${fmtMoney(it.valueAmt)}</span>
      </div>
      <div class="batch-row-right">
        <span class="status-badge status-unused">CHƯA SỬ DỤNG</span>
        <button type="button" class="batch-mini-x" data-remove="${escapeHtml(it.voucherCode)}" title="Bỏ voucher này khỏi danh sách">✕</button>
      </div>
    </div>`
    )
    .join('');
  batchList.querySelectorAll('[data-remove]').forEach((btn) =>
    btn.addEventListener('click', () => removeBatchItem(btn.dataset.remove))
  );

  const total = batchItems.reduce((s, it) => s + (it.valueAmt || 0), 0);
  batchTotal.classList.remove('hidden');
  batchTotal.innerHTML = `<span>Tổng tạm tính (${batchItems.length} voucher)</span><span>${fmtMoney(total)}</span>`;
  batchRedeemAllBtn.textContent = `Thu hồi tất cả (${batchItems.length}) — ${fmtMoney(total)}`;
  batchRedeemAllBtn.disabled = false;
}

function openBatchRedeemConfirm() {
  if (!batchItems.length) return;
  pendingConfirmIsBatch = true;
  const total = batchItems.reduce((s, it) => s + (it.valueAmt || 0), 0);
  confirmRedeemTitle.textContent = `Bạn có muốn thu hồi tất cả ${batchItems.length} voucher này không?`;
  confirmRedeemSub.classList.add('hidden');
  confirmRedeemSubBatch.classList.remove('hidden');
  confirmBatchCount.textContent = batchItems.length;
  confirmBatchAmount.textContent = fmtMoney(total);
  confirmBatchSystem.textContent = selectedConnectionName || 'mặc định';
  confirmRedeemOverlay.classList.remove('hidden');
}

async function confirmBatchRedeem() {
  const codes = batchItems.map((it) => it.voucherCode);
  batchRedeemAllBtn.disabled = true;
  batchClearBtn.disabled = true;
  try {
    const results = await apiFetch('/vouchers/redeem-batch', {
      method: 'POST',
      body: JSON.stringify({ voucherCodes: codes, scanMethod: lastScanMethod, connectionId: selectedConnectionId }),
    });
    renderBatchResult(results);
    results.forEach((r) => {
      if (r.success) {
        addRecentRow({
          time: new Date(),
          voucherCode: r.voucherCode,
          connectionName: r.connectionName || selectedConnectionName,
          valueAmt: r.valueAmt,
          transNum: r.transNum,
          pendingSync: r.pendingSync,
        });
      }
    });
    batchItems = [];
    batchListCard.classList.add('hidden');
  } catch (err) {
    showToast(err.message);
  } finally {
    batchRedeemAllBtn.disabled = false;
    batchClearBtn.disabled = false;
  }
}

/** Ket qua thu hoi hang loat: moi ma co ket qua RIENG (thanh cong/cho dong bo/that bai), tong
 * "THUC THU" o cuoi chi tinh ma thanh cong + dang cho dong bo (KHONG tinh ma that bai) - xem
 * ghi chu voucherService.js#redeemVoucherBatch ve ly do khong the "tat ca hoac khong gi ca". */
function renderBatchResult(results) {
  batchResultCard.classList.remove('hidden');
  const success = results.filter((r) => r.success && !r.pendingSync);
  const pending = results.filter((r) => r.success && r.pendingSync);
  const fail = results.filter((r) => !r.success);

  batchSummaryGrid.innerHTML = `
    <div class="summary-tile tile-success"><div class="num">${success.length + pending.length}</div><div class="lbl">Thành công</div></div>
    <div class="summary-tile tile-pending"><div class="num">${pending.length}</div><div class="lbl">Trong đó chờ đồng bộ</div></div>
    <div class="summary-tile tile-fail"><div class="num">${fail.length}</div><div class="lbl">Thất bại</div></div>
  `;

  batchResultList.innerHTML = results
    .map((r) => {
      const badge = !r.success
        ? '<span class="status-badge status-used">THẤT BẠI</span>'
        : r.pendingSync
        ? '<span class="status-badge status-other">ĐÃ THU HỒI (CHỜ ĐỒNG BỘ)</span>'
        : '<span class="status-badge status-unused">ĐÃ THU HỒI</span>';
      return `
      <div class="batch-result-row">
        <div class="batch-result-row-head">
          <span class="batch-row-code">${escapeHtml(r.voucherCode)}${r.valueAmt != null ? ` <span class="batch-row-amt">— ${fmtMoney(r.valueAmt)}</span>` : ''}</span>
          ${badge}
        </div>
        ${r.message ? `<div class="batch-result-reason">${escapeHtml(r.message)}</div>` : ''}
      </div>`;
    })
    .join('');

  const realTotal = [...success, ...pending].reduce((s, r) => s + (r.valueAmt || 0), 0);
  batchGrandTotal.innerHTML = `
    <div class="amt">${fmtMoney(realTotal)}</div>
    <div class="sub">Tổng THỰC THU (${success.length + pending.length}/${results.length} voucher đã thu hồi thành công${pending.length ? `, kể cả ${pending.length} đang chờ đồng bộ` : ''}) — không tính ${fail.length} voucher thất bại</div>
  `;
}

function addRecentRow(row) {
  recentRows.unshift(row);
  recentRows = recentRows.slice(0, 20);
  recentBody.innerHTML = recentRows
    .map(
      (r) => `
      <tr>
        <td data-label="Giờ">${r.time.toLocaleTimeString('vi-VN')}</td>
        <td data-label="Mã voucher">${escapeHtml(r.voucherCode)}</td>
        <td data-label="Hệ thống">${escapeHtml(r.connectionName || '-')}</td>
        <td data-label="Mệnh giá">${fmtMoney(r.valueAmt)}</td>
        <td data-label="TRANS_NUM">${escapeHtml(r.transNum || '-')}</td>
        <td data-label="Đồng bộ">${r.pendingSync ? '<span class="status-badge status-other">CHỜ ĐỒNG BỘ</span>' : '<span class="status-badge status-unused">ĐÃ ĐỒNG BỘ</span>'}</td>
      </tr>`
    )
    .join('');
}

// Camera dang trong luc bat/tat (co the mat vai giay, nhat la lan dau xin quyen) - khoa nut
// trong luc nay de tranh bam nhanh 2 lan lam camera chay ngam khong tat duoc nua.
let cameraBusy = false;

function toggleCamera() {
  if (cameraBusy) return;
  if (cameraRunning) {
    stopCamera();
    return;
  }

  cameraBusy = true;
  cameraBtn.disabled = true;
  qrReaderEl.classList.remove('hidden');
  html5QrCode = new Html5Qrcode('qr-reader');
  html5QrCode
    .start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 220 },
      (decodedText) => {
        lastScanMethod = 'CAMERA';
        stopCamera();
        runCheck(decodedText.trim());
      },
      () => {}
    )
    .then(() => {
      cameraRunning = true;
      cameraBtn.textContent = 'Dừng camera';
      // An bot phan gioi thieu/o nhap HID (khong can khi dang quet bang camera) de khung camera
      // hien gan dau trang, khong phai keo xuong moi thay - theo phan anh cua nguoi dung tren mobile.
      scanHero.classList.add('hidden');
      scanInputGroup.classList.add('hidden');
      qrReaderEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    })
    .catch((err) => {
      showToast('Không thể mở camera: ' + err.message);
      qrReaderEl.classList.add('hidden');
    })
    .finally(() => {
      cameraBusy = false;
      cameraBtn.disabled = false;
    });
}

function stopCamera() {
  if (!html5QrCode || !cameraRunning) return;
  cameraBusy = true;
  cameraBtn.disabled = true;
  html5QrCode
    .stop()
    .then(() => html5QrCode.clear())
    .catch(() => {})
    .finally(() => {
      qrReaderEl.classList.add('hidden');
      scanHero.classList.remove('hidden');
      scanInputGroup.classList.remove('hidden');
      cameraRunning = false;
      cameraBtn.textContent = 'Quét bằng camera';
      cameraBusy = false;
      cameraBtn.disabled = false;
    });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
