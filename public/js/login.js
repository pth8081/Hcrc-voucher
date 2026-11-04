// continueAfterPrimaryAuth() dung chung, dinh nghia trong twofa.js (load truoc file nay).

let captchaToken = '';

async function loadCaptcha() {
  try {
    const data = await apiFetch('/auth/captcha');
    captchaToken = data.token;
    document.getElementById('captchaImg').src = data.imageDataUrl;
    document.getElementById('captchaText').value = '';
  } catch (err) {
    showToast('Không tải được mã xác thực, vui lòng thử lại.');
  }
}
document.getElementById('captchaRefresh').addEventListener('click', loadCaptcha);
loadCaptcha();

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  await withSubmitLock(form, async () => {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const captchaText = document.getElementById('captchaText').value.trim();
    try {
      const data = await runLoginStep(() =>
        apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password, captchaToken, captchaText }),
        })
      );
      if (data) {
        continueAfterPrimaryAuth(data);
        return;
      }
      // data=null: nguoi dung bam "Huy" o hop thoai "co the dang dang nhap o noi khac" - o lai
      // trang dang nhap. captchaToken DA BI "dung" (captcha chi dung 1 lan) du bam Huy, phai
      // nap ma moi de thu dang nhap lai duoc.
      loadCaptcha();
    } catch (err) {
      showToast(err.message);
      loadCaptcha();
    }
  });
});

const webauthnBtn = document.getElementById('webauthnLoginBtn');
if (typeof webauthnSupported === 'function' && webauthnSupported()) {
  webauthnBtn.classList.remove('hidden');
}

webauthnBtn.addEventListener('click', async () => {
  webauthnBtn.disabled = true;
  try {
    const data = await runLoginStep(loginWithPasskey);
    if (data) continueAfterPrimaryAuth(data);
  } catch (err) {
    if (err.name !== 'NotAllowedError') {
      // NotAllowedError = nguoi dung tu huy hop thoai van tay/Face ID, khong can bao loi.
      showToast(err.message);
    }
  } finally {
    webauthnBtn.disabled = false;
  }
});
