if (!getPendingTwoFactorToken()) {
  window.location.href = '/login.html';
}

// Kiem tra do phuc tap phia client (chi de bao loi som cho nguoi dung) - server van la noi
// kiem tra that su (passwordPolicyService.js), khong dua vao rieng client.
const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;
function clientPasswordProblems(password) {
  const problems = [];
  if (!password || password.length < 8) problems.push('it nhat 8 ky tu');
  if (!/[A-Za-z]/.test(password || '')) problems.push('it nhat 1 chu cai');
  if (!/[0-9]/.test(password || '')) problems.push('it nhat 1 chu so');
  if (!SPECIAL_CHAR_REGEX.test(password || '')) problems.push('it nhat 1 ky tu dac biet');
  return problems;
}

document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (newPassword !== confirmPassword) {
    showToast('Mat khau nhap lai khong khop');
    return;
  }
  const problems = clientPasswordProblems(newPassword);
  if (problems.length) {
    showToast(`Mat khau chua dat yeu cau: ${problems.join(', ')}`);
    return;
  }

  try {
    const data = await twoFaFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
    continueAfterPrimaryAuth(data);
  } catch (err) {
    showToast(err.message);
  }
});
