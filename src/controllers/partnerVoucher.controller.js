const voucherService = require('../services/voucherService');
const { VOUCHER_STATUS } = require('../services/coreVoucherService');
const { extractVoucherCode } = require('../utils/voucherCodeValidation');

/** Dung cho VoucherScanLogs.ScanMethod khi doi tac khong tu gui scanMethod - de phan biet voi
 * cac nguon quet khac (HID_SCANNER/CAMERA/MANUAL) khi tra cuu nhat ky. */
const DEFAULT_SCAN_METHOD = 'PARTNER_API';

async function check(req, res, next) {
  try {
    const { error, voucherCode } = extractVoucherCode(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const result = await voucherService.checkVoucher({
      voucherCode,
      user: req.user,
      scanMethod: req.body.scanMethod || DEFAULT_SCAN_METHOD,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function redeem(req, res, next) {
  try {
    const { error, voucherCode } = extractVoucherCode(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const result = await voucherService.redeemVoucher({
      voucherCode,
      user: req.user,
      scanMethod: req.body.scanMethod || DEFAULT_SCAN_METHOD,
      clientIp: req.ip,
    });

    // Theo dung tai lieu API doi tac (docs/api-voucher-check-redeem.md): rieng truong hop KHONG
    // TIM THAY ma tra ve HTTP 404 voi envelope {"error": "..."} - khac quy uoc {success,message}
    // dung cho moi loi khac cua app (bao gom ca cac ly do tu choi redeem khac nhu USED/EXPIRED).
    // Endpoint JWT hien co (voucher.controller.js) KHONG doi - van tra 200 nhu truoc, tranh anh
    // huong UI web dang chay.
    if (!result.success && result.status === VOUCHER_STATUS.NOT_FOUND) {
      return res.status(404).json({ error: 'Khong tim thay ma' });
    }

    res.json({ success: result.success, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { check, redeem };
