const voucherService = require('../services/voucherService');

function voucherCodeFromBody(req, res) {
  const { voucherCode, scanMethod } = req.body;
  if (!voucherCode || !String(voucherCode).trim()) {
    res.status(400).json({ success: false, message: 'Thieu voucherCode' });
    return null;
  }
  return { voucherCode: String(voucherCode).trim(), scanMethod: scanMethod || 'MANUAL' };
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
