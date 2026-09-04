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

(async function loadQrCode() {
  try {
    const data = await twoFaSetupInit();
    document.getElementById('qrImage').src = data.qrCodeDataUrl;
    document.getElementById('manualKey').textContent = data.manualEntryKey;
  } catch (err) {
    showToast(err.message);
  }
})();

document.getElementById('setupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
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
