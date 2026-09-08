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
    try {
      const result = await callDynamic(connection, 'check', { code: voucherCode });
      return { httpStatus: result.httpStatus, ...result.normalized, status: mapCoreStatus(result.normalized.status) };
    } catch (err) {
      // callDynamic chi throw khi mat mang/timeout/Core 5xx (loi 4xx da duoc xu ly va tra ve
      // binh thuong o tren, khong roi vao day) - nghia la KHONG ket noi duoc toi Core that su.
      throw wrapConnError(err);
    }
  }
  return checkVoucherLegacyEnv(voucherCode);
}

async function redeemVoucher(voucherCode, context) {
  const connection = await apiConnectionService.getActiveDecrypted();
  if (connection) {
    let result;
    try {
      result = await callDynamic(connection, 'redeem', {
        code: voucherCode,
        username: context.username,
        locationsGroup: context.locationsGroup,
        locationsDetail: context.locationsDetail,
        transNum: context.transNum,
      });
    } catch (err) {
      throw wrapConnError(err);
    }
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
    // Core PHAN HOI ro rang (bat ky ma 4xx nao, khong chi 409) nghia la TU CHOI nghiep vu that
    // su (voucher het han/khong hop le/da tieu...) - PHAI tra ve that bai ro rang, KHONG duoc
    // coi la loi ha tang roi van thu hoi tai cho (se tao ra thu hoi "ma" ma Core da tu choi).
    // Chi loi mang/timeout/Core 5xx (khong co response ro rang) moi la loi ha tang thuc su.
    if (err.response && err.response.status === 409) {
      return { httpStatus: 409, success: false, status: VOUCHER_STATUS.USED, message: 'Voucher vua duoc tieu boi giao dich khac, vui long quet ma khac' };
    }
    if (err.response && err.response.status >= 400 && err.response.status < 500) {
      const data = err.response.data;
      return {
        httpStatus: err.response.status,
        success: false,
        status: mapCoreStatus(data && data.status),
        message: (data && data.message) || 'Core tu choi thu hoi voucher nay',
      };
    }
    throw wrapConnError(err);
  }
}

function wrapConnError(err) {
  const wrapped = new Error('Khong the ket noi Core Voucher API');
  wrapped.statusCode = 502;
  // Noi ro day la loi KET NOI toi Core API (khong phai loi du lieu voucher) de nguoi dung/quan
  // tri phan biet duoc voi cac loi nghiep vu khac (voucher het han, da tieu...) va biet huong
  // xu ly dung (kiem tra mang/Core, khong phai kiem tra lai ma voucher).
  wrapped.publicMessage = 'Khong ket noi duoc den Core API de kiem tra/thu hoi voucher. Vui long kiem tra ket noi mang hoac bao quan tri vien neu tinh trang keo dai.';
  wrapped.cause = err;
  return wrapped;
}

module.exports = { checkVoucher, redeemVoucher, VOUCHER_STATUS };
