if (!getPendingTwoFactorToken()) {
  window.location.href = '/login.html';
}

document.getElementById('cancelLink').addEventListener('click', () => clearPendingTwoFactorToken());

document.getElementById('verifyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  await withSubmitLock(form, async () => {
    const code = document.getElementById('code').value.trim();
    try {
      const data = await runLoginStep(() => twoFaLoginVerify(code));
      if (!data) return; // nguoi dung bam Huy o hop thoai "co the dang dang nhap o noi khac".
      clearPendingTwoFactorToken();
      setSession(data.token, data.user);
      window.location.href = '/index.html';
    } catch (err) {
      showToast(err.message);
    }
  });
});
