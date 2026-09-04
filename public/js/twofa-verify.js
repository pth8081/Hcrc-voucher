if (!getPendingTwoFactorToken()) {
  window.location.href = '/login.html';
}

document.getElementById('cancelLink').addEventListener('click', () => clearPendingTwoFactorToken());

document.getElementById('verifyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = document.getElementById('code').value.trim();
  try {
    const data = await twoFaLoginVerify(code);
    clearPendingTwoFactorToken();
    setSession(data.token, data.user);
    window.location.href = '/index.html';
  } catch (err) {
    showToast(err.message);
  }
});
