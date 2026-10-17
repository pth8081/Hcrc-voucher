if (!getPendingTwoFactorToken()) {
  window.location.href = '/login.html';
}

// Kiem tra do phuc tap phia client (chi de bao loi som cho nguoi dung) - server van la noi
// kiem tra that su (passwordPolicyService.js), khong dua vao rieng client.
const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;
function clientPasswordProblems(password) {
  const problems = [];
  if (!password || password.length < 8) problems.push('ít nhất 8 ký tự');
  if (!/[A-Za-z]/.test(password || '')) problems.push('ít nhất 1 chữ cái');
  if (!/[0-9]/.test(password || '')) problems.push('ít nhất 1 chữ số');
  if (!SPECIAL_CHAR_REGEX.test(password || '')) problems.push('ít nhất 1 ký tự đặc biệt');
  return problems;
}

document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (newPassword !== confirmPassword) {
    showToast('Mật khẩu nhập lại không khớp');
    return;
  }
  const problems = clientPasswordProblems(newPassword);
  if (problems.length) {
    showToast(`Mật khẩu chưa đạt yêu cầu: ${problems.join(', ')}`);
    return;
  }

  await withSubmitLock(form, async () => {
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
});
