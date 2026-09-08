// continueAfterPrimaryAuth() dung chung, dinh nghia trong twofa.js (load truoc file nay).

let captchaToken = '';

async function loadCaptcha() {
  try {
    const data = await apiFetch('/auth/captcha');
    captchaToken = data.token;
    document.getElementById('captchaImg').src = data.imageDataUrl;
    document.getElementById('captchaText').value = '';
  } catch (err) {
    showToast('Khong tai duoc ma xac thuc, vui long thu lai.');
  }
}
document.getElementById('captchaRefresh').addEventListener('click', loadCaptcha);
loadCaptcha();

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const captchaText = document.getElementById('captchaText').value.trim();
  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, captchaToken, captchaText }),
    });
    continueAfterPrimaryAuth(data);
  } catch (err) {
    showToast(err.message);
    loadCaptcha();
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
