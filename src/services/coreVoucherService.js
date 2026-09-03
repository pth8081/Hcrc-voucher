const apiConnectionService = require('./apiConnectionService');
const { callDynamic } = require('./dynamicCoreApiClient');
const { buildCoreApiClient } = require('../config/coreApi');

const VOUCHER_STATUS = {
  UNUSED: 'UNUSED',
  USED: 'USED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  NOT_FOUND: 'NOT_FOUND',
};

/**
 * Nguon cau hinh Core API cua app: uu tien connection admin da cau hinh + kich hoat
 * qua man hinh "Ket noi API" (bang ApiConnections). Neu chua co connection nao active,
 * fallback ve cau hinh tinh trong .env (CORE_API_*) de app van chay duoc ngay sau khi cai dat.
 */
async function checkVoucher(voucherCode) {
  const connection = await apiConnectionService.getActiveDecrypted();
  if (connection) {
    const result = await callDynamic(connection, 'check', { code: voucherCode });
    return { httpStatus: result.httpStatus, ...result.normalized, status: mapCoreStatus(result.normalized.status) };
  }
  return checkVoucherLegacyEnv(voucherCode);
}

async function redeemVoucher(voucherCode, context) {
  const connection = await apiConnectionService.getActiveDecrypted();
  if (connection) {
    const result = await callDynamic(connection, 'redeem', {
      code: voucherCode,
      username: context.username,
      locationsGroup: context.locationsGroup,
      locationsDetail: context.locationsDetail,
      transNum: context.transNum,
    });
    return {
      httpStatus: result.httpStatus,
      success: !!result.normalized.success,
      status: mapCoreStatus(result.normalized.status),
      transRef: result.normalized.transRef || null,
      redeemedAt: result.normalized.redeemedAt || new Date().toISOString(),
      message: result.normalized.message || null,
    };
  }
  return redeemVoucherLegacyEnv(voucherCode, context);
}

function mapCoreStatus(rawStatus) {
  if (!rawStatus) return VOUCHER_STATUS.NOT_FOUND;
  const normalized = String(rawStatus).toUpperCase();
  if (VOUCHER_STATUS[normalized]) return VOUCHER_STATUS[normalized];
  return normalized;
}

// ===========================================================================
// Fallback cu (cau hinh tinh qua .env: CORE_API_BASE_URL/CHECK_PATH/REDEEM_PATH).
// Chi dung khi CHUA cau hinh connection nao trong man hinh "Ket noi API".
// Giu lai de app khong bi gian doan trong luc admin dang thiet lap ket noi moi.
// ===========================================================================
async function checkVoucherLegacyEnv(voucherCode) {
  const { client, config } = buildCoreApiClient();
  try {
    // GET + query string: kiem tra la thao tac doc, khong lam thay doi trang thai voucher
    const { data, status } = await client.get(config.checkPath, { params: { voucherCode } });
    if (!data || data.found === false) {
      return { httpStatus: status, found: false, status: VOUCHER_STATUS.NOT_FOUND, message: 'Khong tim thay voucher' };
    }
    return {
      httpStatus: status,
      found: true,
      status: mapCoreStatus(data.status),
      voucherSerial: data.serial || data.voucherSerial || null,
      valueAmt: data.valueAmt != null ? Number(data.valueAmt) : null,
      issueDate: data.issueDate || null,
      expiryDate: data.expiryDate || null,
      message: data.message || null,
    };
  } catch (err) {
    if (err.response && err.response.status === 404) {
      return { httpStatus: 404, found: false, status: VOUCHER_STATUS.NOT_FOUND, message: 'Khong tim thay voucher tren he thong phat hanh' };
    }
    throw wrapConnError(err);
  }
}

async function redeemVoucherLegacyEnv(voucherCode, context) {
  const { client, config } = buildCoreApiClient();
  try {
    const { data, status } = await client.post(config.redeemPath, {
      voucherCode,
      redeemedBy: context.username,
      locationsGroup: context.locationsGroup,
      locationsDetail: context.locationsDetail,
      transNum: context.transNum,
    });
    return {
      httpStatus: status,
      success: !!(data && data.success),
      status: mapCoreStatus(data && data.status),
      transRef: (data && (data.transRef || data.transactionId)) || null,
      redeemedAt: (data && data.redeemedAt) || new Date().toISOString(),
      message: (data && data.message) || null,
    };
  } catch (err) {
    if (err.response && err.response.status === 409) {
      return { httpStatus: 409, success: false, status: VOUCHER_STATUS.USED, message: 'Voucher vua duoc tieu boi giao dich khac, vui long quet ma khac' };
    }
    throw wrapConnError(err);
  }
}

function wrapConnError(err) {
  const wrapped = new Error('Khong the ket noi Core Voucher API');
  wrapped.statusCode = 502;
  wrapped.publicMessage = 'He thong kiem tra/thu hoi voucher tam thoi khong phan hoi, vui long thu lai';
  wrapped.cause = err;
  return wrapped;
}

module.exports = { checkVoucher, redeemVoucher, VOUCHER_STATUS };
