requireAuth();
renderTopbar('email-schedules');

const notAllowedNotice = document.getElementById('notAllowedNotice');
const schedulesCard = document.getElementById('schedulesCard');
const scheduleForm = document.getElementById('scheduleForm');
const formTitle = document.getElementById('formTitle');
const submitBtn = document.getElementById('submitBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const listBody = document.getElementById('listBody');

const REPORT_TYPE_OPTIONS = [
  { value: 'DAILY', label: 'Báo cáo đối soát (hàng ngày)', permission: 'canViewReconciliation' },
  { value: 'SUMMARY', label: 'Báo cáo tổng hợp', permission: 'canViewSummary' },
  { value: 'USED_VOUCHERS', label: 'Danh sách voucher đã sử dụng', permission: 'canViewUsedVouchers' },
];
const REPORT_TYPE_LABEL = Object.fromEntries(REPORT_TYPE_OPTIONS.map((o) => [o.value, o.label]));
const FREQUENCY_LABEL = { DAILY: 'Hàng ngày', WEEKLY: 'Hàng tuần', MONTHLY: 'Hàng tháng' };
const WEEKDAY_LABEL = { 0: 'CN', 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7' };

let editingId = null;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function populateReportTypeOptions() {
  const user = getUser();
  const permissions = (user && user.permissions) || {};
  const isAdmin = user && user.role === 'admin';
  const allowed = REPORT_TYPE_OPTIONS.filter((o) => isAdmin || permissions[o.permission]);
  const select = document.getElementById('f_reportType');
  select.innerHTML = allowed.map((o) => `<option value="${o.value}">${escapeHtml(o.label)}</option>`).join('');
}

/**
 * v3.95: "Diem thu hoi" doi tu 1 select DON (chi chon duoc DUNG 1 diem) sang checkbox NHIEU diem
 * (giong het "He thong voucher" ben duoi) - theo yeu cau nguoi dung: truoc day 1 lich chi gui
 * duoc 1 diem/1 cong ty, muon gui nhieu diem CUNG 1 cong ty phai tao nhieu lich rieng le, bat
 * tien. Chon 1 Cong ty se loc lai danh sach checkbox CHI con diem cua cong ty do (giong cach
 * reportFilters.js lam cho 3 man hinh bao cao thuong) - khong chon Cong ty nao thi hien TOAN BO
 * diem trong pham vi duoc xem.
 */
async function loadUnitCheckboxes(companyId) {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
  const units = await apiFetch(`/reports/filters/redemption-units${query}`);
  const wrap = document.getElementById('f_redemptionUnitIds');
  wrap.innerHTML = units
    .map(
      (u) => `
        <label class="checkbox-inline">
          <input type="checkbox" class="f-unit-checkbox" value="${u.Id}" />
          ${escapeHtml(u.PartnerName || '(chưa có tên)')}
        </label>`
    )
    .join('') || '<p class="text-muted m-0">Không có điểm thu hồi nào trong phạm vi bạn được xem.</p>';
}

function setUnitCheckboxes(ids) {
  const idSet = new Set((ids || []).map(Number));
  document.querySelectorAll('.f-unit-checkbox').forEach((el) => {
    el.checked = idSet.has(Number(el.value));
  });
}
function getUnitCheckboxes() {
  return Array.from(document.querySelectorAll('.f-unit-checkbox:checked')).map((el) => Number(el.value));
}

async function loadFilterOptions() {
  try {
    const [companies, systems] = await Promise.all([
      apiFetch('/reports/filters/companies'),
      apiFetch('/reports/filters/systems'),
    ]);
    const companySelect = document.getElementById('f_companyId');
    companySelect.innerHTML =
      '<option value="">-- Tất cả công ty bạn được xem --</option>' +
      companies.map((c) => `<option value="${c.Id}">${escapeHtml(c.CompanyName)}</option>`).join('');
    await loadUnitCheckboxes(null);
    companySelect.addEventListener('change', async () => {
      await loadUnitCheckboxes(companySelect.value || null);
    });

    // He thong voucher: checkbox (KHONG con la 1 select "all/1 he thong") - nguoi dung PHAI tu
    // tick ro rang he thong nao muon gui, dung chi trong pham vi ho duoc xem (danh sach tra ve
    // tu /reports/filters/systems da la danh sach DA LOC theo quyen cua chinh ho).
    const connWrap = document.getElementById('f_connectionIds');
    connWrap.innerHTML = systems
      .map(
        (s) => `
          <label class="checkbox-inline">
            <input type="checkbox" class="f-connection-checkbox" value="${s.id}" />
            ${escapeHtml(s.name)}
          </label>`
      )
      .join('') || '<p class="text-muted m-0">Bạn chưa được cấp quyền xem hệ thống voucher nào.</p>';
  } catch (err) {
    // Khong chan luong tao lich neu loi o day (vd mang cham) - chi khong co o loc tuy chon,
    // giong triet ly loadSystemOptions() trong scan.js.
    console.error('Khong tai duoc danh sach loc tuy chon:', err.message);
  }
}

function toggleFrequencyFields() {
  const freq = document.getElementById('f_frequency').value;
  document.getElementById('weekDayField').classList.toggle('hidden', freq !== 'WEEKLY');
  document.getElementById('monthDayField').classList.toggle('hidden', freq !== 'MONTHLY');
}
document.getElementById('f_frequency').addEventListener('change', toggleFrequencyFields);

function toggleCustomDateRangeField() {
  const mode = document.getElementById('f_dateRangeMode').value;
  document.getElementById('customDateRangeField').classList.toggle('hidden', mode !== 'CUSTOM');
}
document.getElementById('f_dateRangeMode').addEventListener('change', toggleCustomDateRangeField);

function setConnectionCheckboxes(ids) {
  const idSet = new Set((ids || []).map(Number));
  document.querySelectorAll('.f-connection-checkbox').forEach((el) => {
    el.checked = idSet.has(Number(el.value));
  });
}
function getConnectionCheckboxes() {
  return Array.from(document.querySelectorAll('.f-connection-checkbox:checked')).map((el) => Number(el.value));
}

async function resetForm() {
  editingId = null;
  scheduleForm.reset();
  document.getElementById('f_sendTime').value = '08:00';
  setConnectionCheckboxes([]);
  await loadUnitCheckboxes(null);
  toggleFrequencyFields();
  toggleCustomDateRangeField();
  formTitle.textContent = 'Tạo lịch gửi email mới';
  submitBtn.textContent = 'Tạo lịch';
  cancelEditBtn.classList.add('hidden');
}
cancelEditBtn.addEventListener('click', resetForm);

function scheduleLabel(s) {
  const timeLabel = `${String(s.sendHour).padStart(2, '0')}:${String(s.sendMinute).padStart(2, '0')}`;
  if (s.frequency === 'WEEKLY') return `${FREQUENCY_LABEL.WEEKLY} (${WEEKDAY_LABEL[s.weekDay]}) lúc ${timeLabel}`;
  if (s.frequency === 'MONTHLY') return `${FREQUENCY_LABEL.MONTHLY} (ngày ${s.monthDay}) lúc ${timeLabel}`;
  return `${FREQUENCY_LABEL.DAILY} lúc ${timeLabel}`;
}

function lastSentLabel(s) {
  if (!s.lastSentDate) return '<span class="text-muted">Chưa gửi lần nào</span>';
  const badge = s.lastSentStatus === 'SUCCESS'
    ? '<span class="status-badge status-unused">THÀNH CÔNG</span>'
    : `<span class="status-badge status-used">LỖI</span>`;
  return `${fmtDate(s.lastSentDate)}<br/>${badge}${s.lastSentStatus !== 'SUCCESS' && s.lastSentMessage ? `<div class="fs-13 text-muted">${escapeHtml(s.lastSentMessage)}</div>` : ''}`;
}

async function loadList() {
  try {
    const rows = await apiFetch('/email-schedules');
    renderList(rows);
  } catch (err) {
    notAllowedNotice.classList.remove('hidden');
    schedulesCard.classList.add('hidden');
  }
}

function renderList(rows) {
  if (!rows.length) {
    listBody.innerHTML = '<tr><td colspan="5" class="text-muted">Chưa có lịch nào - tạo mới ở form bên trên</td></tr>';
    return;
  }
  listBody.innerHTML = rows
    .map((s) => `
      <tr data-id="${s.id}">
        <td data-label="Tên lịch">${escapeHtml(s.name)}${s.isEnabled ? '' : ' <span class="status-badge status-other">ĐÃ TẮT</span>'}</td>
        <td data-label="Báo cáo">${escapeHtml(REPORT_TYPE_LABEL[s.reportType] || s.reportType)}</td>
        <td data-label="Giờ gửi">${scheduleLabel(s)}</td>
        <td data-label="Lần gửi gần nhất">${lastSentLabel(s)}</td>
        <td data-label="Hành động">
          <div class="actions-cell">
            <button class="btn-secondary edit-btn" type="button">Sửa</button>
            <button class="btn-secondary send-now-btn" type="button">Gửi ngay</button>
            <button class="btn-secondary toggle-btn" type="button">${s.isEnabled ? 'Tắt' : 'Bật'}</button>
            <button class="btn-danger delete-btn" type="button">Xóa</button>
          </div>
        </td>
      </tr>`)
    .join('');

  listBody.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = tr.dataset.id;
    const schedule = rows.find((s) => String(s.id) === id);
    tr.querySelector('.edit-btn').addEventListener('click', () => startEdit(schedule));
    tr.querySelector('.send-now-btn').addEventListener('click', () => sendNow(id, schedule.name));
    tr.querySelector('.toggle-btn').addEventListener('click', () => toggleEnabled(id, !schedule.isEnabled, schedule.name));
    tr.querySelector('.delete-btn').addEventListener('click', () => removeSchedule(id, schedule.name));
  });
}

async function startEdit(s) {
  editingId = s.id;
  document.getElementById('f_name').value = s.name;
  document.getElementById('f_reportType').value = s.reportType;
  document.getElementById('f_dateRangeMode').value = s.dateRangeMode;
  document.getElementById('f_customFromDate').value = s.customFromDate || '';
  document.getElementById('f_customToDate').value = s.customToDate || '';
  document.getElementById('f_companyId').value = s.companyId || '';
  // Nap lai danh sach checkbox Diem thu hoi DUNG theo Cong ty cua lich nay (giong luc chon tay
  // o form), roi moi tick san cac diem da luu - khong lam tuan tu se tick nham vao checkbox cua
  // danh sach CU (truoc khi loc theo cong ty).
  await loadUnitCheckboxes(s.companyId || null);
  setUnitCheckboxes(s.redemptionUnitIds);
  setConnectionCheckboxes(s.connectionIds);
  document.getElementById('f_recipients').value = s.recipients;
  document.getElementById('f_frequency').value = s.frequency;
  if (s.weekDay !== null && s.weekDay !== undefined) document.getElementById('f_weekDay').value = String(s.weekDay);
  if (s.monthDay !== null && s.monthDay !== undefined) document.getElementById('f_monthDay').value = s.monthDay;
  document.getElementById('f_sendTime').value = `${String(s.sendHour).padStart(2, '0')}:${String(s.sendMinute).padStart(2, '0')}`;
  toggleFrequencyFields();
  toggleCustomDateRangeField();
  formTitle.textContent = `Sửa lịch "${s.name}"`;
  submitBtn.textContent = 'Lưu thay đổi';
  cancelEditBtn.classList.remove('hidden');
  scheduleForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function sendNow(id, name) {
  if (!confirm(`Gửi ngay lịch "${name}" bây giờ?`)) return;
  try {
    await apiFetch(`/email-schedules/${encodeURIComponent(id)}/send-now`, { method: 'POST' });
    showToast(`Đã gửi "${name}"`);
    loadList();
  } catch (err) {
    showToast(err.message);
  }
}

async function toggleEnabled(id, isEnabled, name) {
  try {
    await apiFetch(`/email-schedules/${encodeURIComponent(id)}/enabled`, {
      method: 'PUT',
      body: JSON.stringify({ isEnabled }),
    });
    showToast(isEnabled ? `Đã bật lại "${name}"` : `Đã tắt "${name}"`);
    loadList();
  } catch (err) {
    showToast(err.message);
  }
}

async function removeSchedule(id, name) {
  if (!confirm(`Xóa lịch "${name}"? Không thể khôi phục.`)) return;
  try {
    await apiFetch(`/email-schedules/${encodeURIComponent(id)}`, { method: 'DELETE' });
    showToast(`Đã xóa "${name}"`);
    loadList();
  } catch (err) {
    showToast(err.message);
  }
}

scheduleForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const frequency = document.getElementById('f_frequency').value;
  const [sendHour, sendMinute] = document.getElementById('f_sendTime').value.split(':').map(Number);
  const dateRangeMode = document.getElementById('f_dateRangeMode').value;
  const connectionIds = getConnectionCheckboxes();
  if (!connectionIds.length) {
    showToast('Cần chọn ít nhất 1 hệ thống voucher để gửi báo cáo');
    return;
  }
  const body = {
    name: document.getElementById('f_name').value.trim(),
    reportType: document.getElementById('f_reportType').value,
    dateRangeMode,
    customFromDate: dateRangeMode === 'CUSTOM' ? document.getElementById('f_customFromDate').value : null,
    customToDate: dateRangeMode === 'CUSTOM' ? document.getElementById('f_customToDate').value : null,
    companyId: document.getElementById('f_companyId').value || null,
    redemptionUnitIds: getUnitCheckboxes(),
    connectionIds,
    recipients: document.getElementById('f_recipients').value.trim(),
    frequency,
    sendHour,
    sendMinute,
    weekDay: frequency === 'WEEKLY' ? Number(document.getElementById('f_weekDay').value) : null,
    monthDay: frequency === 'MONTHLY' ? Number(document.getElementById('f_monthDay').value) : null,
  };

  submitBtn.disabled = true;
  try {
    if (editingId) {
      await apiFetch(`/email-schedules/${encodeURIComponent(editingId)}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('Đã lưu thay đổi');
    } else {
      await apiFetch('/email-schedules', { method: 'POST', body: JSON.stringify(body) });
      showToast('Đã tạo lịch gửi email');
    }
    resetForm();
    loadList();
  } catch (err) {
    showToast(err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

populateReportTypeOptions();
toggleFrequencyFields();
toggleCustomDateRangeField();
loadFilterOptions();
loadList();
