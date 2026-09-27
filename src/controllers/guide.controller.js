const { BUSINESS_GUIDE_HTML, SYSTEM_GUIDE_HTML } = require('../content/guideContent');

// Noi dung tra ve la HTML TINH do chinh doi ngu phat trien viet san (khong tu DB/nguoi dung) -
// an toan de frontend render truc tiep, khac voi cac API khac trong app luon phai escapeHtml()
// truoc khi chen du lieu vao trang.
async function business(req, res) {
  res.json({ success: true, data: { html: BUSINESS_GUIDE_HTML } });
}

async function system(req, res) {
  res.json({ success: true, data: { html: SYSTEM_GUIDE_HTML } });
}

module.exports = { business, system };
