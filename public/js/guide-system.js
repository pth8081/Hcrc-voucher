requireAuth();
renderTopbar('guide-system');

const guideBody = document.getElementById('guideBody');

load();

async function load() {
  try {
    const data = await apiFetch('/guides/system');
    // Noi dung tra ve la HTML TINH do doi phat trien tu viet (xem
    // src/content/guideContent.js) - KHONG phai du lieu nguoi dung/DB, an toan chen truc tiep
    // (khac voi moi noi dung khac trong app luon phai escapeHtml() truoc).
    guideBody.innerHTML = data.html;
  } catch (err) {
    guideBody.innerHTML = `<p class="text-danger">${escapeHtmlGuide(err.message)}</p>`;
  }
}

function escapeHtmlGuide(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
