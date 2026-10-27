requireAuth();
renderTopbar('scan');

const voucherInput = document.getElementById('voucherInput');
const cameraBtn = document.getElementById('cameraBtn');
const qrReaderEl = document.getElementById('qr-reader');
const scanHero = document.getElementById('scanHero');
const scanInputGroup = document.getElementById('scanInputGroup');
const recentBody = document.getElementById('recentBody');
const manualBlockedHint = document.getElementById('manualBlockedHint');
const systemSwitchCard = document.getElementById('systemSwitchCard');
const systemSwitch = document.getElementById('systemSwitch');
const systemActiveBanner = document.getElementById('systemActiveBanner');
const systemActiveBannerText = document.getElementById('systemActiveBannerText');
const confirmRedeemOverlay = document.getElementById('confirmRedeemOverlay');
const confirmRedeemTitle = document.getElementById('confirmRedeemTitle');
const confirmCount = document.getElementById('confirmCount');
const confirmAmount = document.getElementById('confirmAmount');
const confirmSystem = document.getElementById('confirmSystem');
const confirmInvoiceLine = document.getElementById('confirmInvoiceLine');
const confirmInvoiceNumber = document.getElementById('confirmInvoiceNumber');
const confirmRedeemYesBtn = document.getElementById('confirmRedeemYesBtn');
const confirmRedeemNoBtn = document.getElementById('confirmRedeemNoBtn');

// Tu v3.78: bo het cong tac "Quet tung cai/Quet nhieu" (v3.75) - CHI CON 1 luong quet DUY NHAT,
// moi ma quet xong luon tu dong them vao 1 danh sach tam (giong het hanh vi "Quet nhieu" cu,
// xem README muc 18/19), CHUA goi thu hoi gi ca cho toi khi bam "Xac nhan thu hoi". Quet dung
// 1 ma van hoat dong binh thuong - danh sach chi co 1 dong, nut xac nhan hien ro so tien DUNG
// 1 ma do (khong con noi "tat ca X voucher" nghe gong khi X=1). Ly do bo cong tac: nguoi dung
// phan anh de nham/quen chuyen che do truoc khi quet - gop lai con 1 luong giam han 1 buoc lua
// chon ma khong doi gi ve logic/bao mat backend (sp_getapplock/rate-limit/guessGuard deu dung
// CHUNG code redeemVoucherBatch() cho moi do dai danh sach, ke ca danh sach 1 phan tu).
const batchListCard = document.getElementById('batchListCard');
const batchList = document.getElementById('batchList');
const batchTotal = document.getElementById('batchTotal');
const invoiceNumberInput = document.getElementById('invoiceNumber');
const batchRedeemAllBtn = document.getElementById('batchRedeemAllBtn');
const batchClearBtn = document.getElementById('batchClearBtn');
const batchResultCard = document.getElementById('batchResultCard');
const batchSummaryGrid = document.getElementById('batchSummaryGrid');
const invoiceResultLine = document.getElementById('invoiceResultLine');
const batchResultList = document.getElementById('batchResultList');
const batchGrandTotal = document.getElementById('batchGrandTotal');
const batchContinueBtn = document.getElementById('batchContinueBtn');

const MAX_BATCH_SIZE = 20; // khop voi gioi han server (voucherService.js#MAX_BATCH_SIZE)
let batchItems = []; // { voucherCode, valueAmt, voucherSerial }

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

batchClearBtn.addEventListener('click', clearBatchList);
batchRedeemAllBtn.addEventListener('click', openRedeemConfirm);
batchContinueBtn.addEventListener('click', () => {
  batchItems = [];
  renderBatchList();
  invoiceNumberInput.value = '';
  batchResultCard.classList.add('hidden');
  focusInput();
});

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
    addToBatchList(voucherCode, data);
    focusInput();
  } catch (err) {
    showToast(err.message);
    focusInput();
  } finally {
    voucherInput.disabled = false;
    cameraBtn.disabled = false;
  }
}

/** Sau buoc CHECK (chua thu hoi gi): hop le thi them vao danh sach tam, khong hop le (da
 * dung/het han/loai tru...) thi bao loi va KHONG them - nguoi dung quet tiep ngay, khong can
 * thao tac gi them cho ma loi do. */
function addToBatchList(voucherCode, data) {
  if (batchItems.some((it) => it.voucherCode === voucherCode)) {
    showToast(`Mã ${voucherCode} đã có trong danh sách, không thêm trùng.`);
    return;
  }
  if (batchItems.length >= MAX_BATCH_SIZE) {
    showToast(`Danh sách đã đủ tối đa ${MAX_BATCH_SIZE} voucher - vui lòng xác nhận thu hồi trước khi quét thêm.`);
    return;
  }
  if (!(data.status === 'UNUSED' && data.canRedeem)) {
    showToast(data.message || 'Voucher này không hợp lệ để thu hồi.');
    return;
  }
  batchItems.push({ voucherCode, valueAmt: data.valueAmt, voucherSerial: data.voucherSerial });
  batchListCard.classList.remove('hidden');
  renderBatchList();
  showToast(`Đã thêm ${voucherCode} vào danh sách (${batchItems.length} voucher)`);
}

function removeBatchItem(voucherCode) {
  batchItems = batchItems.filter((it) => it.voucherCode !== voucherCode);
  renderBatchList();
  if (!batchItems.length) batchListCard.classList.add('hidden');
}

function clearBatchList() {
  if (!batchItems.length) return;
  if (!confirm('Xóa toàn bộ danh sách đang chờ thu hồi?')) return;
  batchItems = [];
  renderBatchList();
  invoiceNumberInput.value = '';
  batchListCard.classList.add('hidden');
  focusInput();
}

function renderBatchList() {
  if (!batchItems.length) {
    batchList.innerHTML = '<p class="text-muted">Chưa quét voucher nào. Quét mã để thêm vào danh sách.</p>';
    batchTotal.classList.add('hidden');
    batchRedeemAllBtn.textContent = 'Xác nhận thu hồi';
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
  const n = batchItems.length;
  batchTotal.classList.remove('hidden');
  batchTotal.innerHTML = `<span>Tổng tạm tính (${n} voucher)</span><span>${fmtMoney(total)}</span>`;
  // Chi 1 ma thi khong can noi "(1)" - "Xac nhan thu hoi - [tien]" la du ro rang; tu 2 ma tro len
  // moi them so luong de nhan vien biet dang xac nhan gop bao nhieu ma 1 luc.
  batchRedeemAllBtn.textContent = n === 1
    ? `Xác nhận thu hồi — ${fmtMoney(total)}`
    : `Xác nhận thu hồi (${n}) — ${fmtMoney(total)}`;
  batchRedeemAllBtn.disabled = false;
}

/** Them 1 buoc xac nhan nua truoc khi goi API thu hoi that su, tranh bam nham/cham nham ngay sau
 * khi quet xong (nhat la tren dien thoai, man hinh cam ung) - theo yeu cau nguoi dung. Dung
 * CHUNG 1 hop thoai cho ca 1 hay nhieu voucher, chi doi chu cho tu nhien hon khi dung 1 ma. */
function openRedeemConfirm() {
  if (!batchItems.length) return;
  const n = batchItems.length;
  const total = batchItems.reduce((s, it) => s + (it.valueAmt || 0), 0);
  confirmRedeemTitle.textContent = n === 1
    ? 'Bạn có muốn thu hồi voucher này không?'
    : `Bạn có muốn thu hồi tất cả ${n} voucher này không?`;
  confirmCount.textContent = n;
  confirmAmount.textContent = fmtMoney(total);
  confirmSystem.textContent = selectedConnectionName || 'mặc định';

  const invoice = invoiceNumberInput.value.trim();
  if (invoice) {
    confirmInvoiceNumber.textContent = invoice;
    confirmInvoiceLine.classList.remove('hidden');
  } else {
    confirmInvoiceLine.classList.add('hidden');
  }

  confirmRedeemOverlay.classList.remove('hidden');
}

confirmRedeemYesBtn.addEventListener('click', () => {
  confirmRedeemOverlay.classList.add('hidden');
  confirmRedeem();
});

confirmRedeemNoBtn.addEventListener('click', () => {
  // "Khong" -> chi dong hop thoai, GIU NGUYEN danh sach dang cho (nguoi dung co the quet them/bo
  // bot roi bam lai "Xac nhan thu hoi" sau) - he thong (BRGmart/Fuji) DANG CHON cung giu nguyen.
  confirmRedeemOverlay.classList.add('hidden');
});

async function confirmRedeem() {
  const codes = batchItems.map((it) => it.voucherCode);
  const invoiceNumber = invoiceNumberInput.value.trim() || null;
  batchRedeemAllBtn.disabled = true;
  batchClearBtn.disabled = true;
  try {
    const results = await apiFetch('/vouchers/redeem-batch', {
      method: 'POST',
      body: JSON.stringify({ voucherCodes: codes, scanMethod: lastScanMethod, connectionId: selectedConnectionId, invoiceNumber }),
    });
    renderBatchResult(results, invoiceNumber);
    results.forEach((r) => {
      if (r.success) {
        addRecentRow({
          time: new Date(),
          voucherCode: r.voucherCode,
          connectionName: r.connectionName || selectedConnectionName,
          valueAmt: r.valueAmt,
          transNum: r.transNum,
          pendingSync: r.pendingSync,
          invoiceNumber,
        });
      }
    });
    batchItems = [];
    invoiceNumberInput.value = '';
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
function renderBatchResult(results, invoiceNumber) {
  batchResultCard.classList.remove('hidden');
  const success = results.filter((r) => r.success && !r.pendingSync);
  const pending = results.filter((r) => r.success && r.pendingSync);
  const fail = results.filter((r) => !r.success);

  batchSummaryGrid.innerHTML = `
    <div class="summary-tile tile-success"><div class="num">${success.length + pending.length}</div><div class="lbl">Thành công</div></div>
    <div class="summary-tile tile-pending"><div class="num">${pending.length}</div><div class="lbl">Trong đó chờ đồng bộ</div></div>
    <div class="summary-tile tile-fail"><div class="num">${fail.length}</div><div class="lbl">Thất bại</div></div>
  `;

  if (invoiceNumber && (success.length || pending.length)) {
    invoiceResultLine.classList.remove('hidden');
    invoiceResultLine.innerHTML = `Đã lưu theo số hóa đơn: <strong>${escapeHtml(invoiceNumber)}</strong> — bạn tra cứu lại được trong báo cáo "Voucher đã sử dụng".`;
  } else {
    invoiceResultLine.classList.add('hidden');
  }

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
        <td data-label="Số hóa đơn">${r.invoiceNumber ? escapeHtml(r.invoiceNumber) : '-'}</td>
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
