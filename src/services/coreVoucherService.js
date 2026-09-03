const { buildCoreApiClient } = require('../config/coreApi');

// Trang thai chuan hoa noi bo, dung xuyen suot app (khong phu thuoc field name cua Core API that)
const VOUCHER_STATUS = {
  UNUSED: 'UNUSED',
  USED: 'USED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  NOT_FOUND: 'NOT_FOUND',
};

/**
 * Goi Core API de kiem tra 1 voucher da tieu hay chua.
 *
 * !!! CAN CHINH SUA THEO CORE API THAT !!!
 * Doan duoi day gia dinh Core API tra ve JSON dang:
 *   { found: true, status: "UNUSED", serial: "...", valueAmt: 100000,
 *     issueDate: "2026-01-01T00:00:00Z", expiryDate: "2026-12-31T23:59:59Z" }
 * Hay sua ham normalizeCheckResponse() ben duoi cho khop field name that su.
 */
async function checkVoucher(voucherCode) {
  const { client, config } = buildCoreApiClient();
  try {
    const { data, status } = await client.post(config.checkPath, { voucherCode });
    return { httpStatus: status, ...normalizeCheckResponse(data) };
  } catch (err) {
    if (err.response && err.response.status === 404) {
      return {
        httpStatus: 404,
        found: false,
        status: VOUCHER_STATUS.NOT_FOUND,
        message: 'Khong tim thay voucher tren he thong phat hanh',
      };
    }
    const wrapped = new Error('Khong the ket noi Core Voucher API');
    wrapped.statusCode = 502;
    wrapped.publicMessage = 'He thong kiem tra voucher tam thoi khong phan hoi, vui long thu lai';
    wrapped.cause = err;
    throw wrapped;
  }
}

/**
 * Goi Core API de danh dau 1 voucher da tieu (thu hoi).
 * Chi goi sau khi checkVoucher() da xac nhan UNUSED va nguoi dung bam "Xac nhan thu hoi".
 */
async function redeemVoucher(voucherCode, context) {
  const { client, config } = buildCoreApiClient();
  try {
    const { data, status } = await client.post(config.redeemPath, {
      voucherCode,
      redeemedBy: context.username,
      locationsGroup: context.locationsGroup,
      locationsDetail: context.locationsDetail,
      transNum: context.transNum,
    });
    return { httpStatus: status, ...normalizeRedeemResponse(data) };
  } catch (err) {
    if (err.response && err.response.status === 409) {
      // Voucher vua bi tieu boi request khac (race condition) -> coi nhu that bai, yeu cau quet lai
      return {
        httpStatus: 409,
        success: false,
        status: VOUCHER_STATUS.USED,
        message: 'Voucher vua duoc tieu boi giao dich khac, vui long quet ma khac',
      };
    }
    const wrapped = new Error('Khong the ket noi Core Voucher API');
    wrapped.statusCode = 502;
    wrapped.publicMessage = 'He thong thu hoi voucher tam thoi khong phan hoi, vui long thu lai';
    wrapped.cause = err;
    throw wrapped;
  }
}

function normalizeCheckResponse(data) {
  if (!data || data.found === false) {
    return { found: false, status: VOUCHER_STATUS.NOT_FOUND, message: 'Khong tim thay voucher' };
  }
  return {
    found: true,
    status: mapCoreStatus(data.status),
    voucherSerial: data.serial || data.voucherSerial || null,
    valueAmt: data.valueAmt != null ? Number(data.valueAmt) : null,
    issueDate: data.issueDate || null,
    expiryDate: data.expiryDate || null,
    message: data.message || null,
  };
}

function normalizeRedeemResponse(data) {
  return {
    success: !!(data && data.success),
    status: mapCoreStatus(data && data.status),
    transRef: data && (data.transRef || data.transactionId) || null,
    redeemedAt: (data && data.redeemedAt) || new Date().toISOString(),
    message: (data && data.message) || null,
  };
}

function mapCoreStatus(rawStatus) {
  if (!rawStatus) return VOUCHER_STATUS.NOT_FOUND;
  const normalized = String(rawStatus).toUpperCase();
  if (VOUCHER_STATUS[normalized]) return VOUCHER_STATUS[normalized];
  return normalized;
}

module.exports = { checkVoucher, redeemVoucher, VOUCHER_STATUS };
