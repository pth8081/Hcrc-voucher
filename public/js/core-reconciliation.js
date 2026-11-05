requireAuth();
renderTopbar('core-reconciliation');

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const noAccessNotice = document.getElementById('noAccessNotice');
const mainCard = document.getElementById('mainCard');
const companySelect = document.getElementById('companySelect');
const systemField = document.getElementById('systemField');
const systemChecklist = document.getElementById('systemChecklist');
const fromDateInput = document.getElementById('fromDateInput');
const toDateInput = document.getElementById('toDateInput');
const startBtn = document.getElementById('startBtn');
const estimateHint = document.getElementById('estimateHint');
const errorHint = document.getElementById('errorHint');
const maxVouchersHint = document.getElementById('maxVouchersHint');

const progressCard = document.getElementById('progressCard');
const runStatusBadge = document.getElementById('runStatusBadge');
const runScopeHint = document.getElementById('runScopeHint');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const statTotal = document.getElementById('statTotal');
const statMatch = document.getElementById('statMatch');
const statMismatch = document.getElementById('statMismatch');
const resultActions = document.getElementById('resultActions');
const mismatchOnlyCheckbox = document.getElementById('mismatchOnlyCheckbox');
const exportBtn = document.getElementById('exportBtn');
const emailToggleBtn = document.getElementById('emailToggleBtn');
const emailSendRow = document.getElementById('emailSendRow');
const emailRecipientsInput = document.getElementById('emailRecipientsInput');
const emailSendBtn = document.getElementById('emailSendBtn');
const emailCancelBtn = document.getElementById('emailCancelBtn');
const emailSentHint = document.getElementById('emailSentHint');
const resultsCard = document.getElementById('resultsCard');
const resultsTableWrap = document.getElementById('resultsTableWrap');
const emptyFilterHint = document.getElementById('emptyFilterHint');
const resultsBody = document.getElementById('resultsBody');
const historyBody = document.getElementById('historyBody');

let pollTimer = null;
let currentRunId = null;

init();

async function init() {
  try {
    const filters = await apiFetch('/core-reconciliation/filters');
    renderFilters(filters);
  } catch (err) {
    noAccessNotice.classList.remove('hidden');
    mainCard.classList.add('hidden');
    return;
  }
  loadHistory();

  [companySelect, fromDateInput, toDateInput].forEach((el) => el.addEventListener('change', updateEstimate));
  startBtn.addEventListener('click', startReconciliation);
  mismatchOnlyCheckbox.addEventListener('change', applyMismatchFilter);
  exportBtn.addEventListener('click', exportExcel);
  emailToggleBtn.addEventListener('click', () => {
    emailSentHint.classList.add('hidden');
    emailSendRow.classList.toggle('hidden');
  });
  emailCancelBtn.addEventListener('click', () => {
    emailSendRow.classList.add('hidden');
  });
  emailSendBtn.addEventListener('click', sendEmail);
}

function renderFilters(filters) {
  companySelect.innerHTML = '<option value="">Tất cả công ty bạn được xem</option>'
    + filters.companies.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  if (filters.scope === 'ALL' && filters.systems.length) {
    systemField.classList.remove('hidden');
    systemChecklist.innerHTML = filters.systems.map((s) => `
      <label>
        <input type="checkbox" class="checkbox-input system-checkbox" value="${s.id}" />
        ${escapeHtml(s.name)}
      </label>`).join('');
    systemChecklist.querySelectorAll('.system-checkbox').forEach((el) => el.addEventListener('change', updateEstimate));
  } else {
    systemField.classList.add('hidden');
  }
}

function getSelectedConnectionIds() {
  return Array.from(systemChecklist.querySelectorAll('.system-checkbox:checked')).map((el) => Number(el.value));
}

function currentFilterBody() {
  return {
    companyId: companySelect.value ? Number(companySelect.value) : null,
    connectionIds: getSelectedConnectionIds(),
    fromDate: fromDateInput.value,
    toDate: toDateInput.value,
  };
}

async function updateEstimate() {
  errorHint.classList.add('hidden');
  if (!fromDateInput.value || !toDateInput.value) {
    estimateHint.textContent = '';
    return;
  }
  try {
    const data = await apiFetch('/core-reconciliation/estimate', { method: 'POST', body: JSON.stringify(currentFilterBody()) });
    estimateHint.textContent = data.exceedsLimit
      ? `Vượt quá giới hạn - có hơn ${maxVouchersHint.textContent} voucher trong phạm vi này, vui lòng chọn khoảng ngày hẹp hơn.`
      : `Ước tính khoảng ${data.count.toLocaleString('vi-VN')} voucher trong phạm vi đã chọn.`;
    estimateHint.classList.toggle('text-danger', data.exceedsLimit);
  } catch (err) {
    estimateHint.textContent = '';
  }
}

async function startReconciliation() {
  errorHint.classList.add('hidden');
  if (!fromDateInput.value || !toDateInput.value) {
    errorHint.textContent = 'Vui lòng chọn đủ Từ ngày và Đến ngày.';
    errorHint.classList.remove('hidden');
    return;
  }
  startBtn.disabled = true;
  try {
    const result = await apiFetch('/core-reconciliation', { method: 'POST', body: JSON.stringify(currentFilterBody()) });
    currentRunId = result.runId;
    showRunning(result.totalCount);
    pollRun(currentRunId);
  } catch (err) {
    errorHint.textContent = err.message || 'Không thể bắt đầu đối soát';
    errorHint.classList.remove('hidden');
  } finally {
    startBtn.disabled = false;
  }
}

function showRunning(totalCount) {
  progressCard.classList.remove('hidden');
  resultsCard.classList.add('hidden');
  resultActions.classList.add('hidden');
  emailSendRow.classList.add('hidden');
  emailSentHint.classList.add('hidden');
  runStatusBadge.textContent = 'ĐANG CHẠY';
  runStatusBadge.className = 'status-badge status-other';
  progressFill.classList.remove('is-failed');
  progressFill.max = totalCount || 1;
  progressFill.value = 0;
  statTotal.textContent = totalCount.toLocaleString('vi-VN');
  statMatch.textContent = '0';
  statMismatch.textContent = '0';
  progressText.textContent = `Đã kiểm tra xong 0/${totalCount} voucher với Core.`;
  progressCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function pollRun(runId) {
  if (pollTimer) clearInterval(pollTimer);
  const tick = async () => {
    let run;
    try {
      run = await apiFetch(`/core-reconciliation/${encodeURIComponent(runId)}`);
    } catch (err) {
      return;
    }
    renderRunProgress(run);
    if (run.status !== 'RUNNING') {
      clearInterval(pollTimer);
      pollTimer = null;
      if (run.results.length) renderResults(run.results);
      loadHistory();
    }
  };
  tick();
  pollTimer = setInterval(tick, 2000);
}

function renderRunProgress(run) {
  progressFill.max = run.totalCount || 1;
  progressFill.value = run.checkedCount || 0;
  statTotal.textContent = run.totalCount.toLocaleString('vi-VN');
  statMatch.textContent = run.matchCount.toLocaleString('vi-VN');
  statMismatch.textContent = run.mismatchCount.toLocaleString('vi-VN');
  runScopeHint.textContent = `${run.scopeLabel} · chạy lúc ${fmtDate(run.createdDate)} bởi ${run.createdByUsername}`;

  if (run.status === 'RUNNING') {
    progressText.textContent = `Đã kiểm tra xong ${run.checkedCount}/${run.totalCount} voucher với Core.`;
    runStatusBadge.textContent = 'ĐANG CHẠY';
    runStatusBadge.className = 'status-badge status-other';
    resultActions.classList.add('hidden');
  } else if (run.status === 'DONE') {
    progressText.textContent = `Đã kiểm tra xong ${run.checkedCount}/${run.totalCount} voucher với Core.`;
    runStatusBadge.textContent = 'HOÀN TẤT';
    runStatusBadge.className = 'status-badge status-unused';
    resultActions.classList.remove('hidden');
  } else {
    progressFill.classList.add('is-failed');
    progressText.textContent = `Lỗi: ${run.errorMessage || 'Không xác định'} (đã kiểm tra ${run.checkedCount}/${run.totalCount} voucher trước khi dừng)`;
    runStatusBadge.textContent = 'LỖI';
    runStatusBadge.className = 'status-badge status-used';
    resultActions.classList.add('hidden');
  }
}

const CORE_STATUS_LABELS = {
  USED: 'Đã dùng (USED)',
  UNUSED: 'Chưa dùng (UNUSED)',
  EXPIRED: 'Hết hạn (EXPIRED)',
  CANCELLED: 'Đã hủy (CANCELLED)',
  NOT_FOUND: 'Không tìm thấy',
  ERROR: 'Không gọi được Core',
};

let lastResults = [];

function renderResults(results) {
  lastResults = results;
  resultsCard.classList.remove('hidden');
  // Mac dinh CHI tick "chi hien CHUA KHOP" khi THAT SU co dong chua khop - neu moi voucher deu
  // khop (truong hop pho bien, tot nhat), de tick san se khien bang ket qua trong trien va
  // KHONG CO GI hien ra (thead bi an tren mobile boi .table-responsive) - trong nhu man hinh
  // dang loi, gay hieu nham "khong liet ke tren web" du du lieu van co, chi la dang bi loc het.
  const hasMismatch = results.some((r) => r.matchResult === 'MISMATCH');
  mismatchOnlyCheckbox.checked = hasMismatch;
  resultsBody.innerHTML = results.map((row) => {
    const isMatch = row.matchResult === 'MATCH';
    const coreLabel = CORE_STATUS_LABELS[row.coreStatus] || escapeHtml(row.coreMessage || row.coreStatus || '-');
    return `
      <tr class="result-row" data-match="${row.matchResult}">
        <td data-label="Mã voucher">${escapeHtml(row.voucherCode)}</td>
        <td data-label="Công ty">${escapeHtml(row.companyName || '-')}</td>
        <td data-label="Điểm tiêu">${escapeHtml(row.pointName || '-')}</td>
        <td data-label="Người thu hồi">${escapeHtml(row.redeemedByUserName || '-')}</td>
        <td data-label="Thời gian thu hồi (hệ thống)">${fmtDate(row.redeemedDate)}</td>
        <td data-label="Trạng thái trên Core"><span class="status-badge ${isMatch ? 'status-unused' : 'status-used'}">${coreLabel}</span></td>
        <td data-label="Kết quả đối soát"><span class="status-badge ${isMatch ? 'status-unused' : 'status-used'}">${isMatch ? 'KHỚP' : 'CHƯA KHỚP'}</span></td>
      </tr>`;
  }).join('');
  applyMismatchFilter();
}

function applyMismatchFilter() {
  const onlyMismatch = mismatchOnlyCheckbox.checked;
  let visibleCount = 0;
  resultsBody.querySelectorAll('.result-row').forEach((tr) => {
    const hide = onlyMismatch && tr.dataset.match === 'MATCH';
    tr.classList.toggle('hidden', hide);
    if (!hide) visibleCount += 1;
  });
  // Bang trong hoan toan (ca thead cung bi an tren mobile boi .table-responsive) de nguoi dung
  // biet day la KET QUA LOC (tat ca deu khop), khong phai loi khong liet ke duoc gi.
  const showEmptyHint = visibleCount === 0 && resultsBody.querySelectorAll('.result-row').length > 0;
  emptyFilterHint.classList.toggle('hidden', !showEmptyHint);
  resultsTableWrap.classList.toggle('hidden', showEmptyHint);
}

async function exportExcel() {
  if (!currentRunId) return;
  exportBtn.disabled = true;
  try {
    const res = await fetch(`/api/core-reconciliation/${encodeURIComponent(currentRunId)}/export`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `Lỗi xuất Excel (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `doi-soat-core-${currentRunId}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast(err.message);
  } finally {
    exportBtn.disabled = false;
  }
}

async function sendEmail() {
  const recipients = emailRecipientsInput.value.trim();
  if (!recipients) {
    showToast('Vui lòng nhập ít nhất 1 email người nhận');
    return;
  }
  emailSendBtn.disabled = true;
  try {
    await apiFetch(`/core-reconciliation/${encodeURIComponent(currentRunId)}/send-email`, {
      method: 'POST',
      body: JSON.stringify({ recipients }),
    });
    emailSendRow.classList.add('hidden');
    emailRecipientsInput.value = '';
    emailSentHint.classList.remove('hidden');
    showToast('Đã gửi email đối soát');
  } catch (err) {
    showToast(err.message || 'Gửi email thất bại');
  } finally {
    emailSendBtn.disabled = false;
  }
}

async function loadHistory() {
  try {
    const rows = await apiFetch('/core-reconciliation');
    renderHistory(rows);
  } catch (err) {
    historyBody.innerHTML = '<tr><td colspan="7" class="text-muted">Không tải được lịch sử.</td></tr>';
  }
}

const HISTORY_STATUS_LABELS = { RUNNING: 'Đang chạy', DONE: 'Hoàn tất', FAILED: 'Lỗi' };

function renderHistory(rows) {
  if (!rows.length) {
    historyBody.innerHTML = '<tr><td colspan="7" class="text-muted">Chưa có lần đối soát nào.</td></tr>';
    return;
  }
  historyBody.innerHTML = rows.map((r) => `
    <tr>
      <td data-label="Thời gian chạy">${fmtDate(r.createdDate)}</td>
      <td data-label="Người chạy">${escapeHtml(r.createdByUsername)}</td>
      <td data-label="Phạm vi">${escapeHtml(r.scopeLabel || '-')}</td>
      <td data-label="Tổng số">${r.totalCount}</td>
      <td data-label="Khớp"><span class="status-badge status-unused">${r.matchCount}</span></td>
      <td data-label="Chưa khớp"><span class="status-badge ${r.mismatchCount ? 'status-used' : 'status-other'}">${r.mismatchCount}</span></td>
      <td data-label="Hành động">
        ${r.status === 'RUNNING'
          ? `<span class="text-muted fs-13">${HISTORY_STATUS_LABELS[r.status]}...</span>`
          : `<button class="btn-secondary btn-sm view-run-btn" data-id="${r.id}">Xem lại</button>`}
      </td>
    </tr>`).join('');
  historyBody.querySelectorAll('.view-run-btn').forEach((btn) => {
    btn.addEventListener('click', () => viewRun(Number(btn.dataset.id)));
  });
}

async function viewRun(runId) {
  currentRunId = runId;
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  progressCard.classList.remove('hidden');
  emailSendRow.classList.add('hidden');
  emailSentHint.classList.add('hidden');
  try {
    const run = await apiFetch(`/core-reconciliation/${encodeURIComponent(runId)}`);
    renderRunProgress(run);
    renderResults(run.results);
    progressCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    showToast(err.message || 'Không tải được lần đối soát này');
  }
}
