const voucherService = require('../services/voucherService');
const { extractVoucherCode } = require('../utils/voucherCodeValidation');

function voucherCodeFromBody(req, res) {
  const { error, voucherCode } = extractVoucherCode(req.body);
  if (error) {
    res.status(400).json({ success: false, message: error });
    return null;
  }
  return { voucherCode, scanMethod: req.body.scanMethod || 'MANUAL' };
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
