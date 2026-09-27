// Dung chung giua controller JWT (voucher.controller.js) va controller API key cho doi tac
// (partnerVoucher.controller.js) - tranh 2 noi tu dinh nghia lai cung 1 gioi han, de lech nhau
// theo thoi gian (vd 1 ben sua MAX_VOUCHER_CODE_LENGTH nhung quen sua ben kia).
const MAX_VOUCHER_CODE_LENGTH = 24; // khop voi sql.NVarChar(24) dung trong voucherService.js/apiConnectionService.js

/** Doc + kiem tra voucherCode tu request body. Tra ve { voucherCode } neu hop le, hoac
 * { error: <thong bao> } neu khong - controller tu quyet dinh HTTP status/envelope phu hop. */
function extractVoucherCode(body) {
  const raw = body && body.voucherCode;
  const trimmed = raw ? String(raw).trim() : '';
  if (!trimmed) return { error: 'Thieu voucherCode' };
  if (trimmed.length > MAX_VOUCHER_CODE_LENGTH) {
    return { error: `Ma voucher qua dai (toi da ${MAX_VOUCHER_CODE_LENGTH} ky tu)` };
  }
  return { voucherCode: trimmed };
}

module.exports = { extractVoucherCode, MAX_VOUCHER_CODE_LENGTH };
