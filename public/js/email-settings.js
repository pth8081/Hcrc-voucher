requireAuth();
renderTopbar('email-settings');

const notAdminNotice = document.getElementById('notAdminNotice');
const settingsCard = document.getElementById('settingsCard');
const settingsForm = document.getElementById('settingsForm');
const saveBtn = document.getElementById('saveBtn');
const testBtn = document.getElementById('testBtn');
const statusText = document.getElementById('statusText');

const KEEP_SECRET = '__KEEP__';

async function load() {
  try {
    const config = await apiFetch('/email-gateway');
    if (config) {
      document.getElementById('f_host').value = config.host || '';
      document.getElementById('f_port').value = config.port || '';
      document.getElementById('f_secure').checked = !!config.secure;
      document.getElementById('f_rejectUnauthorized').checked = !!config.rejectUnauthorized;
      document.getElementById('f_username').value = config.username || '';
      document.getElementById('f_password').placeholder = config.hasPassword
        ? 'Đã lưu mật khẩu - bỏ trống để giữ nguyên'
        : 'Bỏ trống để giữ nguyên mật khẩu đã lưu';
      document.getElementById('f_fromEmail').value = config.fromEmail || '';
      document.getElementById('f_fromName').value = config.fromName || '';
      statusText.textContent = config.updatedDate
        ? `Cập nhật lần cuối bởi ${config.updatedBy || '-'} lúc ${fmtDate(config.updatedDate)}`
        : '';
    }
  } catch (err) {
    notAdminNotice.classList.remove('hidden');
    settingsCard.classList.add('hidden');
  }
}

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  saveBtn.disabled = true;
  try {
    await apiFetch('/email-gateway', {
      method: 'PUT',
      body: JSON.stringify({
        host: document.getElementById('f_host').value.trim(),
        port: Number(document.getElementById('f_port').value),
        secure: document.getElementById('f_secure').checked,
        rejectUnauthorized: document.getElementById('f_rejectUnauthorized').checked,
        username: document.getElementById('f_username').value.trim() || null,
        password: document.getElementById('f_password').value || KEEP_SECRET,
        fromEmail: document.getElementById('f_fromEmail').value.trim(),
        fromName: document.getElementById('f_fromName').value.trim() || null,
      }),
    });
    document.getElementById('f_password').value = '';
    showToast('Đã lưu cấu hình email');
    load();
  } catch (err) {
    showToast(err.message);
  } finally {
    saveBtn.disabled = false;
  }
});

testBtn.addEventListener('click', async () => {
  const toEmail = document.getElementById('testEmail').value.trim();
  if (!toEmail) {
    showToast('Vui lòng nhập email nhận thử');
    return;
  }
  testBtn.disabled = true;
  try {
    await apiFetch('/email-gateway/test', { method: 'POST', body: JSON.stringify({ toEmail }) });
    showToast(`Đã gửi email thử đến ${toEmail} - kiểm tra hộp thư để xác nhận`);
  } catch (err) {
    showToast(err.message);
  } finally {
    testBtn.disabled = false;
  }
});

load();
