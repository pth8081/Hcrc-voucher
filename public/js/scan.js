requireAuth();

const user = getUser();
document.getElementById('whoami').textContent = user ? `${user.fullName || user.username}` : '';
document.getElementById('logoutLink').addEventListener('click', (e) => {
  e.preventDefault();
  clearSession();
  window.location.href = '/login.html';
});

const voucherInput = document.getElementById('voucherInput');
const checkBtn = document.getElementById('checkBtn');
const cameraBtn = document.getElementById('cameraBtn');
const qrReaderEl = document.getElementById('qr-reader');
const resultCard = document.getElementById('resultCard');
const statusBadge = document.getElementById('statusBadge');
const resultInfo = document.getElementById('resultInfo');
const resultActions = document.getElementById('resultActions');
const recentBody = document.getElementById('recentBody');

let lastScanMethod = 'MANUAL';
let html5QrCode = null;
let cameraRunning = false;
let recentRows = [];

focusInput();

voucherInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    lastScanMethod = 'HID_SCANNER';
    runCheck();
  }
});

checkBtn.addEventListener('click', () => {
  lastScanMethod = 'MANUAL';
  runCheck();
});

cameraBtn.addEventListener('click', toggleCamera);

function focusInput() {
  voucherInput.value = '';
  voucherInput.focus();
}

async function runCheck() {
  const voucherCode = voucherInput.value.trim();
  if (!voucherCode) return;

  try {
    checkBtn.disabled = true;
    const data = await apiFetch('/vouchers/check', {
      method: 'POST',
      body: JSON.stringify({ voucherCode, scanMethod: lastScanMethod }),
    });
    renderResult(voucherCode, data);
  } catch (err) {
    showToast(err.message);
    focusInput();
  } finally {
    checkBtn.disabled = false;
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
    confirmBtn.className = 'btn-primary';
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
      showToast(`Thu hoi thanh cong: ${voucherCode}`);
      addRecentRow({ time: new Date(), voucherCode, valueAmt: data.valueAmt, transNum: data.transNum });
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
        voucherInput.value = decodedText;
        lastScanMethod = 'CAMERA';
        stopCamera();
        runCheck();
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
