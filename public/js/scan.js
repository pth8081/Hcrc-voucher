requireAuth();
renderTopbar('scan');

const voucherInput = document.getElementById('voucherInput');
const cameraBtn = document.getElementById('cameraBtn');
const qrReaderEl = document.getElementById('qr-reader');
const resultCard = document.getElementById('resultCard');
const statusBadge = document.getElementById('statusBadge');
const resultInfo = document.getElementById('resultInfo');
const resultActions = document.getElementById('resultActions');
const recentBody = document.getElementById('recentBody');
const manualBlockedHint = document.getElementById('manualBlockedHint');

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

focusInput();

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
  showToast('Khong cho phep nhap tay ma voucher, vui long dung may quet hoac camera');
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
      body: JSON.stringify({ voucherCode, scanMethod: lastScanMethod }),
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
    statusBadge.innerHTML = '<span class="status-badge status-unused">CHUA SU DUNG</span>';
    resultInfo.innerHTML = `
      <div class="info-row"><span class="k">Ma voucher</span><span class="v">${escapeHtml(voucherCode)}</span></div>
      <div class="info-row"><span class="k">So serial</span><span class="v">${escapeHtml(data.voucherSerial || '-')}</span></div>
      <div class="info-row"><span class="k">Menh gia</span><span class="v">${fmtMoney(data.valueAmt)}</span></div>
      <div class="info-row"><span class="k">Ngay cap</span><span class="v">${fmtDate(data.issueDate)}</span></div>
      <div class="info-row"><span class="k">Han su dung</span><span class="v">${fmtDate(data.expiryDate)}</span></div>
    `;
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn-success';
    confirmBtn.textContent = 'Xac nhan thu hoi';
    confirmBtn.addEventListener('click', () => confirmRedeem(voucherCode));

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-secondary';
    cancelBtn.textContent = 'Huy / Quet ma khac';
    cancelBtn.addEventListener('click', resetResult);

    resultActions.appendChild(confirmBtn);
    resultActions.appendChild(cancelBtn);
  } else if (data.status === 'USED') {
    statusBadge.innerHTML = '<span class="status-badge status-used">DA SU DUNG</span>';
    resultInfo.innerHTML = `<p>${escapeHtml(data.message || 'Voucher nay da duoc su dung. Vui long quet ma voucher khac.')}</p>`;
    addContinueButton();
  } else {
    statusBadge.innerHTML = '<span class="status-badge status-other">KHONG HOP LE</span>';
    resultInfo.innerHTML = `<p>${escapeHtml(data.message || 'Voucher khong ton tai hoac khong hop le.')}</p>`;
    addContinueButton();
  }
}

function addContinueButton() {
  const btn = document.createElement('button');
  btn.className = 'btn-secondary';
  btn.textContent = 'Quet ma khac';
  btn.addEventListener('click', resetResult);
  resultActions.appendChild(btn);
}

async function confirmRedeem(voucherCode) {
  try {
    const buttons = resultActions.querySelectorAll('button');
    buttons.forEach((b) => (b.disabled = true));

    const data = await apiFetch('/vouchers/redeem', {
      method: 'POST',
      body: JSON.stringify({ voucherCode, scanMethod: lastScanMethod }),
    });

    if (data.success) {
      const msg = data.pendingSync
        ? `Da thu hoi: ${voucherCode} (dang cho dong bo voi he thong trung tam)`
        : `Thu hoi thanh cong: ${voucherCode}`;
      showToast(msg);
      addRecentRow({ time: new Date(), voucherCode, valueAmt: data.valueAmt, transNum: data.transNum, pendingSync: data.pendingSync });
      resetResult();
    } else {
      showToast(data.message || 'Thu hoi that bai');
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
        <td>${r.time.toLocaleTimeString('vi-VN')}</td>
        <td>${escapeHtml(r.voucherCode)}</td>
        <td>${fmtMoney(r.valueAmt)}</td>
        <td>${escapeHtml(r.transNum || '-')}</td>
        <td>${r.pendingSync ? '<span class="status-badge status-other">CHO DONG BO</span>' : '<span class="status-badge status-unused">DA DONG BO</span>'}</td>
      </tr>`
    )
    .join('');
}

function toggleCamera() {
  if (cameraRunning) {
    stopCamera();
    return;
  }
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
      cameraBtn.textContent = 'Dung camera';
    })
    .catch((err) => {
      showToast('Khong the mo camera: ' + err.message);
      qrReaderEl.classList.add('hidden');
    });
}

function stopCamera() {
  if (html5QrCode && cameraRunning) {
    html5QrCode.stop().then(() => {
      html5QrCode.clear();
      qrReaderEl.classList.add('hidden');
      cameraRunning = false;
      cameraBtn.textContent = 'Quet bang camera';
    });
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
