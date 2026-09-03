const { sql, getPool } = require('../config/db');
const coreVoucherService = require('./coreVoucherService');
const systemLogService = require('./systemLogService');
const { generateTransNum } = require('../utils/transNum');
const guessGuard = require('../utils/guessGuard');
const { SYNC_PROC_NAME } = require('../utils/syncConstants');

const { VOUCHER_STATUS } = coreVoucherService;

/**
 * Buoc 1: Quet ma -> doi chieu voi Core API xem voucher da tieu hay chua.
 * KHONG lam thay doi trang thai voucher, chi doc + ghi log.
 *
 * Giao dien chi cho phep quet (khong cho go tay), nhung vi ai co token deu goi thang
 * duoc API nay nen van can chan brute-force/do ma o phia server: khoa tam thoi neu
 * 1 nguoi dung co qua nhieu lan kiem tra ma KHONG TON TAI lien tiep (guessGuard).
 */
async function checkVoucher({ voucherCode, user, scanMethod }) {
  guessGuard.assertNotLocked(user.userId);

  const result = await coreVoucherService.checkVoucher(voucherCode);
  guessGuard.recordResult(user.userId, result.status === VOUCHER_STATUS.UNUSED || result.status === VOUCHER_STATUS.USED);

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
 *
 * Phan biet 2 loai that bai khi goi Core API danh dau tieu:
 * - Core PHAN HOI ro rang la khong cho tieu (vd voucher vua bi nguoi khac tieu truoc,
 *   het han...) -> TU CHOI thu hoi, khong luu gi ca. Day la loi nghiep vu that.
 * - KHONG GOI DUOC Core (mat mang, Core dang bao tri, timeout...) -> VAN cho thu hoi
 *   tai cho (vi da xac nhan UNUSED it giay truoc do), luu vao VOUCHER_SYNC voi Sync='N'
 *   de coi nhu "hang doi cho dong bo", job tu dong (syncRetryService) se gui lai sau.
 *   Day la loi ha tang, khong nen lam gian doan giao dich thuc te voi khach hang.
 */
async function redeemVoucher({ voucherCode, user, scanMethod, clientIp }) {
  guessGuard.assertNotLocked(user.userId);

  // Kiem tra lai ngay truoc khi tieu de tranh doi tac bam xac nhan sau khi da co nguoi khac tieu truoc.
  // Buoc nay BAT BUOC phai goi duoc Core (khong co no thi khong biet voucher con hop le hay khong),
  // nen loi ket noi o day van chan giao dich nhu cu, KHONG dua vao hang doi.
  const precheck = await coreVoucherService.checkVoucher(voucherCode);
  guessGuard.recordResult(user.userId, precheck.status === VOUCHER_STATUS.UNUSED || precheck.status === VOUCHER_STATUS.USED);

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
  let redeemResult;
  let pendingSync = false;
  let syncErrorMessage = null;

  try {
    redeemResult = await coreVoucherService.redeemVoucher(voucherCode, {
      username: user.username,
      locationsGroup: user.locationsGroup,
      locationsDetail: user.locationsDetail,
      transNum,
    });
  } catch (err) {
    pendingSync = true;
    syncErrorMessage = err.message;
    redeemResult = { success: true, status: 'REDEEMED', transRef: null, redeemedAt: new Date().toISOString() };
  }

  if (!pendingSync && !redeemResult.success) {
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
    synced: !pendingSync,
  });

  await systemLogService.logExecution({
    proName: SYNC_PROC_NAME,
    pKey: transNum,
    uniqueIdGroup: voucherCode,
    status: pendingSync ? 'PENDING' : 'SUCCESS',
    message: pendingSync
      ? `Khong ket noi duoc Core API luc thu hoi, da dua vao hang doi dong bo: ${syncErrorMessage}`
      : 'Da bao Core API thu hoi thanh cong (dong bo ngay)',
    syncRecord: pendingSync ? 0 : 1,
  });

  await logScan({
    user,
    voucherCode,
    scanMethod,
    action: 'REDEEM',
    resultStatus: pendingSync ? 'REDEEMED_PENDING_SYNC' : 'REDEEMED',
    valueAmt: precheck.valueAmt,
    clientIp,
    message: pendingSync
      ? 'Da thu hoi tai cho, dang cho dong bo lai voi he thong trung tam'
      : redeemResult.message,
  });

  return {
    success: true,
    status: pendingSync ? 'REDEEMED_PENDING_SYNC' : 'REDEEMED',
    pendingSync,
    transNum,
    valueAmt: precheck.valueAmt,
    redeemedAt: redeemResult.redeemedAt,
  };
}

async function insertVoucherSync({ user, transNum, voucherCode, voucherSerial, valueAmt, synced }) {
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
    .input('sync', sql.NVarChar(2), synced ? 'Y' : 'N')
    .query(`
      INSERT INTO dbo.VOUCHER_SYNC
        (userid, User_Name, TRANS_NUM, Voucher_Serial, Voucher_Code, Created_Date,
         Status, Computer_name, Locations_Group, Locations_Detail, VALUE_AMT,
         Last_update, Sync, Sync_update)
      VALUES
        (@userid, @userName, @transNum, @voucherSerial, @voucherCode, GETDATE(),
         @status, @computerName, @locationsGroup, @locationsDetail, @valueAmt,
         GETDATE(), @sync, @sync)
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
