const crypto = require('crypto');

// Bo 0/O va 1/I/L de tranh nham lan khi doc tren dien thoai.
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LENGTH = 4;
const TTL_MS = 3 * 60 * 1000;

function randomText() {
  let text = '';
  for (let i = 0; i < LENGTH; i += 1) {
    text += CHARS[crypto.randomInt(CHARS.length)];
  }
  return text;
}

function sign(text, expiresAt) {
  const secret = process.env.JWT_SECRET || '';
  return crypto.createHmac('sha256', secret).update(`${text}:${expiresAt}`).digest('hex');
}

function rand(min, max) {
  return Math.round(Math.random() * (max - min) + min);
}

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Ve ma xac thuc thanh anh SVG (nhieu duong keo nhieu + chu xoay lech nhe) de gay kho cho
 * script tu dong doc so voi text thuong, van doc duoc bang mat thuong. */
function renderSvg(text) {
  const width = 140;
  const height = 50;

  let noise = '';
  for (let i = 0; i < 5; i += 1) {
    noise += `<line x1="${rand(0, width)}" y1="${rand(0, height)}" x2="${rand(0, width)}" y2="${rand(0, height)}" stroke="hsl(${rand(0, 360)},40%,80%)" stroke-width="1"/>`;
  }

  let chars = '';
  for (let i = 0; i < text.length; i += 1) {
    const x = 20 + i * 28;
    const y = 33 + rand(-4, 4);
    const rotate = rand(-18, 18);
    const hue = rand(195, 225);
    chars += `<text x="${x}" y="${y}" font-size="26" font-family="Arial, sans-serif" font-weight="700" fill="hsl(${hue}, 45%, 32%)" transform="rotate(${rotate} ${x} ${y})">${escapeXml(text[i])}</text>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f4f5f6"/>${noise}${chars}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * Sinh 1 ma xac thuc moi. Token TU KY (HMAC, dung JWT_SECRET co san) - KHONG luu trong DB hay
 * bo nho dung chung, nen hoat dong dung khi chay nhieu worker (CLUSTER_WORKERS > 1, xem
 * README) va khong can don dep du lieu het han.
 */
function generate() {
  const text = randomText();
  const expiresAt = Date.now() + TTL_MS;
  const token = `${expiresAt}.${sign(text, expiresAt)}`;
  return { token, imageDataUrl: renderSvg(text) };
}

/** Xac minh ma nguoi dung nhap khop voi token da phat (con han, dung chu ky). Khong phan biet
 * hoa/thuong de de nhap tren dien thoai. */
function verify(token, userInput) {
  if (!token || !userInput) return false;
  const [expiresAtRaw, sig] = String(token).split('.');
  const expiresAt = Number(expiresAtRaw);
  if (!expiresAt || !sig || Date.now() > expiresAt) return false;

  const expectedSig = sign(String(userInput).trim().toUpperCase(), expiresAt);
  const a = Buffer.from(expectedSig);
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { generate, verify };
