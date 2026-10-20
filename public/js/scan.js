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
const confirmRedeemCode = document.getElementById('confirmRedeemCode');
const confirmRedeemAmount = document.getElementById('confirmRedeemAmount');
const confirmRedeemSystem = document.getElementById('confirmRedeemSystem');
const confirmRedeemYesBtn = document.getElementById('confirmRedeemYesBtn');
const confirmRedeemNoBtn = document.getElementById('confirmRedeemNoBtn');

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
    renderResult(voucherCode, data);
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
  confirmRedeemCode.textContent = voucherCode;
  confirmRedeemAmount.textContent = fmtMoney(data.valueAmt);
  confirmRedeemSystem.textContent = selectedConnectionName || 'mặc định';
  confirmRedeemOverlay.classList.remove('hidden');
  resultActions.querySelectorAll('button').forEach((b) => (b.disabled = true));
}

function closeRedeemConfirm() {
  confirmRedeemOverlay.classList.add('hidden');
  pendingRedeemVoucherCode = null;
  resultActions.querySelectorAll('button').forEach((b) => (b.disabled = false));
}

confirmRedeemYesBtn.addEventListener('click', () => {
  const voucherCode = pendingRedeemVoucherCode;
  closeRedeemConfirm();
  if (voucherCode) confirmRedeem(voucherCode);
});

confirmRedeemNoBtn.addEventListener('click', () => {
  // "Khong" -> thoat ve man hinh scan san sang - he thong (BRGmart/Fuji) DANG CHON van giu
  // nguyen, khong reset lai (selectedConnectionId/Name khong bi dong cham o day).
  closeRedeemConfirm();
  resetResult();
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
