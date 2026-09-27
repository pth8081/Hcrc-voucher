const voucherService = require('../services/voucherService');

// Dot ra soat sau phat hien: cot Voucher_Code trong VOUCHER_SYNC/goi Core API deu dung
// sql.NVarChar(24) (xem voucherService.js, apiConnectionService.js) - truoc day khong kiem tra
// do dai o day, 1 ma qua 24 ky tu se lam driver mssql nem loi ngay o buoc .input() (thay vi loi
// nghiep vu ro rang), tra ve 500 khong ro rang thay vi 400 de hieu. Kiem tra som de tra loi sach.
const MAX_VOUCHER_CODE_LENGTH = 24;

function voucherCodeFromBody(req, res) {
  const { voucherCode, scanMethod } = req.body;
  const trimmed = voucherCode ? String(voucherCode).trim() : '';
  if (!trimmed) {
    res.status(400).json({ success: false, message: 'Thieu voucherCode' });
    return null;
  }
  if (trimmed.length > MAX_VOUCHER_CODE_LENGTH) {
    res.status(400).json({ success: false, message: `Ma voucher qua dai (toi da ${MAX_VOUCHER_CODE_LENGTH} ky tu)` });
    return null;
  }
  return { voucherCode: trimmed, scanMethod: scanMethod || 'MANUAL' };
}

async function check(req, res, next) {
  try {
    const input = voucherCodeFromBody(req, res);
    if (!input) return;
    const result = await voucherService.checkVoucher({ ...input, user: req.user });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function redeem(req, res, next) {
  try {
    const input = voucherCodeFromBody(req, res);
    if (!input) return;
    const result = await voucherService.redeemVoucher({
      ...input,
      user: req.user,
      clientIp: req.ip,
    });
    res.json({ success: result.success, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { check, redeem };
