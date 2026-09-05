// continueAfterPrimaryAuth() dung chung, dinh nghia trong twofa.js (load truoc file nay).

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    continueAfterPrimaryAuth(data);
  } catch (err) {
    showToast(err.message);
  }
});

const webauthnBtn = document.getElementById('webauthnLoginBtn');
if (typeof webauthnSupported === 'function' && webauthnSupported()) {
  webauthnBtn.classList.remove('hidden');
}

webauthnBtn.addEventListener('click', async () => {
  webauthnBtn.disabled = true;
  try {
    const data = await loginWithPasskey();
    continueAfterPrimaryAuth(data);
  } catch (err) {
    if (err.name !== 'NotAllowedError') {
      // NotAllowedError = nguoi dung tu huy hop thoai van tay/Face ID, khong can bao loi.
      showToast(err.message);
    }
  } finally {
    webauthnBtn.disabled = false;
  }
});
