const crypto = require('crypto');

/**
 * Sinh TRANS_NUM 18 ky tu (khop max length cua VOUCHER_SYNC.TRANS_NUM)
 * Dinh dang: yyMMddHHmmss + 6 ky tu ngau nhien
 */
function generateTransNum() {
  const now = new Date();
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  const stamp =
    pad(now.getFullYear() % 100) +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds());
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${stamp}${rand}`;
}

module.exports = { generateTransNum };
