const voucherService = require('../services/voucherService');
const apiConnectionService = require('../services/apiConnectionService');
const userVoucherSystemService = require('../services/userVoucherSystemService');

// Dot ra soat sau phat hien: cot Voucher_Code trong VOUCHER_SYNC/goi Core API deu dung
// sql.NVarChar(24) (xem voucherService.js, apiConnectionService.js) - truoc day khong kiem tra
// do dai o day, 1 ma qua 24 ky tu se lam driver mssql nem loi ngay o buoc .input() (thay vi loi
// nghiep vu ro rang), tra ve 500 khong ro rang thay vi 400 de hieu. Kiem tra som de tra loi sach.
const MAX_VOUCHER_CODE_LENGTH = 24;

function voucherCodeFromBody(req, res) {
  const { voucherCode, scanMethod, connectionId } = req.body;
  const trimmed = voucherCode ? String(voucherCode).trim() : '';
  if (!trimmed) {
    res.status(400).json({ success: false, message: 'Thieu voucherCode' });
    return null;
  }
  if (trimmed.length > MAX_VOUCHER_CODE_LENGTH) {
    res.status(400).json({ success: false, message: `Ma voucher qua dai (toi da ${MAX_VOUCHER_CODE_LENGTH} ky tu)` });
    return null;
  }
  return {
    voucherCode: trimmed,
    scanMethod: scanMethod || 'MANUAL',
    // He thong voucher nguoi dung chon tren man hinh Quet voucher (vd "BRGmart"/"Fuji") - tuy
    // chon, de trong se dung ket noi active mac dinh (xem coreVoucherService.js#resolveConnection).
    connectionId: connectionId ? Number(connectionId) : null,
  };
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

/**
 * "Quet nhieu - Thu hoi 1 lan": nhan 1 mang voucherCodes (da quet/kiem tra o man hinh truoc do) -
 * xem voucherService.js#redeemVoucherBatch ve cach xu ly tuan tu tung ma/co che khi 1 ma that bai
 * khong lam dung ca lo. `success: true` cua response nay CHI nghia la REQUEST da xu ly xong (du
 * tung ma ben trong co the thanh cong/that bai khac nhau) - giao dien doc `data[].success` cua
 * TUNG ma de biet ket qua that su, khong doc o `success` muc ngoai.
 */
async function redeemBatch(req, res, next) {
  try {
    const { voucherCodes, scanMethod, connectionId } = req.body;
    if (!Array.isArray(voucherCodes) || !voucherCodes.length) {
      return res.status(400).json({ success: false, message: 'Thieu danh sach voucherCodes' });
    }
    const tooLong = voucherCodes.find((c) => String(c || '').trim().length > MAX_VOUCHER_CODE_LENGTH);
    if (tooLong) {
      return res.status(400).json({ success: false, message: `Ma voucher qua dai (toi da ${MAX_VOUCHER_CODE_LENGTH} ky tu)` });
    }
    const results = await voucherService.redeemVoucherBatch({
      voucherCodes,
      scanMethod: scanMethod || 'MANUAL',
      connectionId: connectionId ? Number(connectionId) : null,
      user: req.user,
      clientIp: req.ip,
    });
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

/** Danh sach he thong voucher de chon tren man hinh Quet voucher - xem apiConnectionService.js#
 * listOptions (rut gon, khong lo chi tiet cau hinh/secret cho nhan vien khong phai admin). Loc
 * lai theo DUNG he thong tai khoan nay duoc phep dung (userVoucherSystemService.js) - 1 tai
 * khoan bi gioi han chi Fuji se khong con thay BRGmart trong danh sach de chon. */
async function systems(req, res, next) {
  try {
    const [all, allowed] = await Promise.all([
      apiConnectionService.listOptions(),
      userVoucherSystemService.getAllowedConnectionIds(req.user.userId),
    ]);
    const data = allowed === null ? all : all.filter((c) => allowed.includes(c.id));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { check, redeem, redeemBatch, systems };
