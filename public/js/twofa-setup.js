const hasFullSession = !!getToken();

// Da dang nhap day du (tu chon "Doi thiet bi 2FA" trong trang Bao mat) -> huy thi quay lai
// trang Bao mat. Chua co phien (buoc bat buoc ngay sau dang nhap lan dau) -> huy thi xoa token
// tam va quay lai trang dang nhap.
const cancelLink = document.getElementById('cancelLink');
if (hasFullSession) {
  cancelLink.href = '/security.html';
} else {
  cancelLink.addEventListener('click', () => clearPendingTwoFactorToken());
  if (!getPendingTwoFactorToken()) {
    window.location.href = '/login.html';
  }
}

const passwordGate = document.getElementById('passwordGate');
const setupContent = document.getElementById('setupContent');

async function loadQrCode(password) {
  try {
    const data = await twoFaSetupInit(password);
    document.getElementById('qrImage').src = data.qrCodeDataUrl;
    document.getElementById('manualKey').textContent = data.manualEntryKey;
    passwordGate.classList.add('hidden');
    setupContent.classList.remove('hidden');
  } catch (err) {
    showToast(err.message);
  }
}

// Doi thiet bi tu 1 phien day du da co san -> bat buoc xac nhan lai mat khau truoc (server
// cung tu choi neu thieu/sai, day chi la buoc UI tuong ung). Thiet lap lan dau (token tam,
// chua co phien) -> khong can, tai QR ngay.
if (hasFullSession) {
  passwordGate.classList.remove('hidden');
  const confirmPasswordBtn = document.getElementById('confirmPasswordBtn');
  confirmPasswordBtn.addEventListener('click', async () => {
    const password = document.getElementById('confirmPassword').value;
    if (!password) {
      showToast('Vui long nhap mat khau');
      return;
    }
    confirmPasswordBtn.disabled = true;
    try {
      await loadQrCode(password);
    } finally {
      confirmPasswordBtn.disabled = false;
    }
  });
} else {
  loadQrCode();
}

document.getElementById('setupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  await withSubmitLock(form, async () => {
    const code = document.getElementById('code').value.trim();
    try {
      const data = await twoFaSetupVerify(code);
      if (data.token) {
        clearPendingTwoFactorToken();
        setSession(data.token, data.user);
        window.location.href = '/index.html';
        return;
      }
      showToast('Da cap nhat thiet bi xac thuc hai yeu to');
      window.location.href = '/security.html';
    } catch (err) {
      showToast(err.message);
    }
  });
});
