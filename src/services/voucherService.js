const { sql, getPool } = require('../config/db');
const coreVoucherService = require('./coreVoucherService');
const { generateTransNum } = require('../utils/transNum');

const { VOUCHER_STATUS } = coreVoucherService;

/**
 * Buoc 1: Quet ma -> doi chieu voi Core API xem voucher da tieu hay chua.
 * KHONG lam thay doi trang thai voucher, chi doc + ghi log.
 */
async function checkVoucher({ voucherCode, user, scanMethod }) {
  const result = await coreVoucherService.checkVoucher(voucherCode);

  await logScan({
    user,
    voucherCode,
    scanMethod,
    action: 'CHECK',
    resultStatus: result.status,
    valueAmt: result.valueAmt,
    expiryDate: result.expiryDate,
    issueDate: result.issueDate,
    httpStatus: result.httpStatus,
    message: result.message,
  });

  if (result.status === VOUCHER_STATUS.USED) {
    return {
      canRedeem: false,
      status: result.status,
      message: 'Voucher nay da duoc su dung. Vui long quet ma voucher khac.',
    };
  }

  if (result.status !== VOUCHER_STATUS.UNUSED) {
    return {
      canRedeem: false,
      status: result.status,
      message: result.message || 'Voucher khong hop le hoac khong ton tai.',
    };
  }

  return {
    canRedeem: true,
    status: result.status,
    voucherSerial: result.voucherSerial,
    valueAmt: result.valueAmt,
    issueDate: result.issueDate,
    expiryDate: result.expiryDate,
  };
}

/**
 * Buoc 2: Nguoi dung xac nhan thu hoi -> goi Core API danh dau da tieu,
 * roi luu ban ghi vao VOUCHER_SYNC de doi soat hang ngay.
 */
async function redeemVoucher({ voucherCode, user, scanMethod, clientIp }) {
  // Kiem tra lai ngay truoc khi tieu de tranh doi tac bam xac nhan sau khi da co nguoi khac tieu truoc
  const precheck = await coreVoucherService.checkVoucher(voucherCode);
  if (precheck.status !== VOUCHER_STATUS.UNUSED) {
    await logScan({
      user,
      voucherCode,
      scanMethod,
      action: 'REDEEM',
      resultStatus: precheck.status,
      clientIp,
      message: 'Tu choi thu hoi: voucher khong con o trang thai UNUSED khi xac nhan',
    });
    return {
      success: false,
      status: precheck.status,
      message: 'Voucher da doi trang thai, vui long quet lai truoc khi thu hoi.',
    };
  }

  const transNum = generateTransNum();
  const redeemResult = await coreVoucherService.redeemVoucher(voucherCode, {
    username: user.username,
    locationsGroup: user.locationsGroup,
    locationsDetail: user.locationsDetail,
    transNum,
  });

  if (!redeemResult.success) {
    await logScan({
      user,
      voucherCode,
      scanMethod,
      action: 'REDEEM',
      resultStatus: redeemResult.status || 'ERROR',
      clientIp,
      message: redeemResult.message,
    });
    return {
      success: false,
      status: redeemResult.status,
      message: redeemResult.message || 'Thu hoi voucher that bai, vui long quet ma khac.',
    };
  }

  await insertVoucherSync({
    user,
    transNum,
    voucherCode,
    voucherSerial: precheck.voucherSerial,
    valueAmt: precheck.valueAmt,
  });

  await logScan({
    user,
    voucherCode,
    scanMethod,
    action: 'REDEEM',
    resultStatus: 'REDEEMED',
    valueAmt: precheck.valueAmt,
    clientIp,
    message: redeemResult.message,
  });

  return {
    success: true,
    status: 'REDEEMED',
    transNum,
    valueAmt: precheck.valueAmt,
    redeemedAt: redeemResult.redeemedAt,
  };
}

async function insertVoucherSync({ user, transNum, voucherCode, voucherSerial, valueAmt }) {
  const pool = await getPool();
  await pool
    .request()
    .input('userid', sql.Int, user.userId)
    .input('userName', sql.NChar(60), user.fullName || user.username)
    .input('transNum', sql.Char(18), transNum)
    .input('voucherSerial', sql.NVarChar(100), voucherSerial || '')
    .input('voucherCode', sql.NVarChar(24), voucherCode)
    .input('status', sql.NVarChar(240), 'REDEEMED')
    .input('computerName', sql.NVarChar(100), 'PARTNER_REDEMPTION_APP')
    .input('locationsGroup', sql.NVarChar(100), user.locationsGroup || '')
    .input('locationsDetail', sql.NVarChar(100), user.locationsDetail || '')
    .input('valueAmt', sql.Numeric(9), valueAmt || 0)
    .query(`
      INSERT INTO dbo.VOUCHER_SYNC
        (userid, User_Name, TRANS_NUM, Voucher_Serial, Voucher_Code, Created_Date,
         Status, Computer_name, Locations_Group, Locations_Detail, VALUE_AMT,
         Last_update, Sync, Sync_update)
      VALUES
        (@userid, @userName, @transNum, @voucherSerial, @voucherCode, GETDATE(),
         @status, @computerName, @locationsGroup, @locationsDetail, @valueAmt,
         GETDATE(), 'N', 'N')
    `);
}

async function logScan({
  user,
  voucherCode,
  scanMethod,
  action,
  resultStatus,
  valueAmt,
  expiryDate,
  issueDate,
  httpStatus,
  clientIp,
  message,
}) {
  const pool = await getPool();
  await pool
    .request()
    .input('userId', sql.Int, user ? user.userId : null)
    .input('userName', sql.NVarChar(100), user ? user.username : null)
    .input('locationsGroup', sql.NVarChar(100), user ? user.locationsGroup : null)
    .input('locationsDetail', sql.NVarChar(100), user ? user.locationsDetail : null)
    .input('voucherCode', sql.NVarChar(24), voucherCode)
    .input('scanMethod', sql.NVarChar(20), scanMethod || 'MANUAL')
    .input('action', sql.NVarChar(10), action)
    .input('resultStatus', sql.NVarChar(20), resultStatus)
    .input('valueAmt', sql.Numeric(18, 2), valueAmt || null)
    .input('expiryDate', sql.DateTime, expiryDate ? new Date(expiryDate) : null)
    .input('issueDate', sql.DateTime, issueDate ? new Date(issueDate) : null)
    .input('httpStatus', sql.Int, httpStatus || null)
    .input('message', sql.NVarChar(1000), message || null)
    .input('clientIp', sql.NVarChar(60), clientIp || null)
    .query(`
      INSERT INTO dbo.VoucherScanLogs
        (UserId, UserName, LocationsGroup, LocationsDetail, VoucherCode, ScanMethod,
         Action, ResultStatus, ValueAmt, VoucherExpiryDate, VoucherIssueDate,
         CoreApiHttpStatus, CoreApiMessage, ClientIp, CreatedDate)
      VALUES
        (@userId, @userName, @locationsGroup, @locationsDetail, @voucherCode, @scanMethod,
         @action, @resultStatus, @valueAmt, @expiryDate, @issueDate,
         @httpStatus, @message, @clientIp, GETDATE())
    `);
}

module.exports = { checkVoucher, redeemVoucher };
