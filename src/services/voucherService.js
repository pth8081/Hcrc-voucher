const { sql, getPool } = require('../config/db');
const coreVoucherService = require('./coreVoucherService');
const systemLogService = require('./systemLogService');
const locationService = require('./locationService');
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
 *
 * Tra cuu CSDL noi bo (VOUCHER_SYNC) TRUOC khi hoi Core: neu CHINH app nay da tung ghi nhan
 * da tieu ma nay (ke ca dang cho dong bo, Sync='N') thi CHAC CHAN da tieu - tra loi ngay,
 * khong can goi Core (nhanh hon, giam tai Core). Day CHI la duong tat de TU CHOI nhanh hon -
 * neu KHONG thay o local van PHAI hoi Core nhu cu, vi khong the ket luan "con dung duoc" chi
 * vi local chua co (co the da bi tieu qua kenh khac ngoai app nay).
 */
async function checkVoucher({ voucherCode, user, scanMethod }) {
  guessGuard.assertNotLocked(user.userId);

  const localRedeemed = await findLocalRedemption(voucherCode);
  if (localRedeemed) {
    guessGuard.recordResult(user.userId, true);
    await logScan({
      user,
      voucherCode,
      scanMethod,
      action: 'CHECK',
      resultStatus: VOUCHER_STATUS.USED,
      message: `Da tieu truoc do tai CSDL noi bo (TRANS_NUM ${localRedeemed.TRANS_NUM}), khong can goi Core`,
    });
    return {
      canRedeem: false,
      status: VOUCHER_STATUS.USED,
      message: 'Voucher nay da duoc su dung. Vui long quet ma voucher khac.',
    };
  }

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
 *
 * QUAN TRONG (chong 2 nguoi quet trung ma gan nhu cung luc): lay khoa sp_getapplock TRUOC
 * khi goi Core, giu khoa xuyen suot ca lenh goi Core LAN ghi VOUCHER_SYNC, chi nha khoa khi
 * commit/rollback. Truoc day khoa chi bao quanh buoc ghi DB (sau khi da goi Core xong) nen 2
 * request trung ma van goi Core DONG THOI duoc - request "thua" trong buoc ghi DB co giao
 * dich Core THAT SU da thanh cong nhung bi mat dau vet hoan toan. Gio khoa bao truoc ca buoc
 * goi Core nen 2 request trung ma se tu dong xep hang, request thu 2 se thay ngay o buoc
 * kiem tra "da co ban ghi" ma KHONG can goi Core nua.
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

  let outcome;
  try {
    outcome = await redeemAndInsertGuarded({ user, transNum, voucherCode, precheck });
  } catch (err) {
    // C1: neu Core DA XAC NHAN thu hoi thanh cong (khong phai do Core loi ket noi - truong hop
    // do da duoc gan pendingSync=true va van ghi DB binh thuong) nhung buoc ghi VOUCHER_SYNC
    // van that bai vi ly do khac (het gio cho khoa, tran so valueAmt, mat ket noi DB giua
    // chung...), day la 1 giao dich CO THAT nhung co nguy co mat dau vet hoan toan - PHAI ghi
    // canh bao muc CRITICAL de quan tri doi soat thu cong, KHONG duoc de loi troi qua am tham.
    if (err.coreConfirmedSuccess) {
      // Ca 2 lenh ghi canh bao ben duoi deu dung CUNG 1 pool SQL vua that bai o buoc INSERT phia
      // tren - neu nguyen nhan la mat ket noi DB (khong phai loi rieng cua 1 cau lenh), CA 2 lan
      // ghi log nay co the that bai THEO CUNG 1 ly do, khien canh bao CRITICAL bi mat hoan toan
      // (chinh tinh huong "khong duoc am tham nuot loi" ma tinh nang nay sinh ra de tranh - da bi
      // 1 dot ra soat sau phat hien). Bao boc rieng, co console.error lam kenh du phong cuoi
      // cung (luon co trong log tien trinh du DB co con song hay khong).
      try {
        await systemLogService.logExecution({
          proName: SYNC_PROC_NAME,
          pKey: transNum,
          uniqueIdGroup: voucherCode,
          status: 'FAILED_CRITICAL',
          message: `Core da xac nhan thu hoi thanh cong (transRef=${err.coreTransRef || 'khong co'}) nhung ghi VOUCHER_SYNC that bai: ${err.message}. CAN DOI SOAT THU CONG NGAY - khong duoc quet lai ma nay qua app.`,
          syncRecord: 0,
        });
        await logScan({
          user,
          voucherCode,
          scanMethod,
          action: 'REDEEM',
          resultStatus: 'ERROR_UNRECORDED',
          clientIp,
          message: `Core da xac nhan thu hoi nhung ghi VOUCHER_SYNC loi: ${err.message}`,
        });
      } catch (alertErr) {
        // eslint-disable-next-line no-console
        console.error(
          `[CRITICAL][KHONG GHI DUOC CANH BAO VAO DB] Core da xac nhan thu hoi THANH CONG cho voucher=${voucherCode}, transNum=${transNum}, transRef=${err.coreTransRef || 'khong co'}, user=${user && user.username}, nhung ca buoc ghi VOUCHER_SYNC LAN buoc ghi canh bao vao DB deu that bai. Loi ghi VOUCHER_SYNC goc: ${err.message}. Loi ghi canh bao: ${alertErr.message}. CAN DOI SOAT THU CONG NGAY.`
        );
      }
      const critErr = new Error('Core da xac nhan thu hoi thanh cong nhung he thong ghi nhan cuc bo bi loi.');
      critErr.statusCode = 500;
      critErr.publicMessage = 'Core da xac nhan thu hoi THANH CONG nhung he thong ghi nhan cuc bo bi loi. KHONG quet lai ma nay - vui long bao quan tri vien NGAY de doi soat thu cong.';
      throw critErr;
    }
    throw err;
  }

  if (outcome.duplicate) {
    await logScan({
      user,
      voucherCode,
      scanMethod,
      action: 'REDEEM',
      resultStatus: VOUCHER_STATUS.USED,
      clientIp,
      message: 'Tu choi thu hoi: da co ban ghi VOUCHER_SYNC khac ghi nhan dung luc (chan trung theo ma voucher)',
    });
    return {
      success: false,
      status: VOUCHER_STATUS.USED,
      message: 'Voucher nay vua duoc thu hoi (co the tu thiet bi/quay khac). Vui long quet ma khac.',
    };
  }

  if (!outcome.pendingSync && !outcome.redeemResult.success) {
    await logScan({
      user,
      voucherCode,
      scanMethod,
      action: 'REDEEM',
      resultStatus: outcome.redeemResult.status || 'ERROR',
      clientIp,
      message: outcome.redeemResult.message,
    });
    return {
      success: false,
      status: outcome.redeemResult.status,
      message: outcome.redeemResult.message || 'Thu hoi voucher that bai, vui long quet ma khac.',
    };
  }

  const { pendingSync, redeemResult, syncErrorMessage } = outcome;

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

/** Tim ban ghi da thu hoi (neu co) cua 1 ma voucher trong VOUCHER_SYNC - dung index co san
 * IX_VOUCHER_SYNC_Voucher_Code (sql/003) nen tra cuu nhanh du bang co nhieu du lieu. */
async function findLocalRedemption(voucherCode) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('voucherCode', sql.NVarChar(24), voucherCode)
    .query(`
      SELECT TOP 1 TRANS_NUM
      FROM dbo.VOUCHER_SYNC
      WHERE Voucher_Code = @voucherCode
      ORDER BY Created_Date DESC
    `);
  return result.recordset[0] || null;
}

/** Ep valueAmt ve 1 so hop le, an toan de ghi vao cot Numeric(18,2) - Core la he thong ngoai
 * khong do app nay kiem soat, phan hoi co the thieu/sai kieu/qua lon (VD tran so gay loi
 * INSERT, chinh la 1 nguyen nhan khien buoc ghi VOUCHER_SYNC that bai sau khi Core da xac
 * nhan thanh cong - xem C1). Gia tri khong hop le -> coi la 0 va ghi log canh bao, KHONG de
 * loi troi ra ngoai lam mat ca giao dich. */
function sanitizeValueAmt(rawValueAmt, { voucherCode, transNum } = {}) {
  const n = Number(rawValueAmt);
  const MAX_SAFE_AMT = 9999999999999999.99; // gioi han cua Numeric(18,2)
  if (!Number.isFinite(n) || n < 0 || n > MAX_SAFE_AMT) {
    // eslint-disable-next-line no-console
    console.warn(`[voucherService] valueAmt tra ve tu Core khong hop le (${rawValueAmt}) cho voucher ${voucherCode} (transNum ${transNum}) - da ghi la 0, can kiem tra lai mapping/du lieu Core.`);
    return 0;
  }
  return n;
}

/**
 * Goi Core API thu hoi VA ghi VOUCHER_SYNC trong CUNG 1 khoa (sp_getapplock, theo dung ma
 * voucher, pham vi 1 transaction) - xem ghi chu H5 o redeemVoucher() phia tren ve ly do gop
 * lai. KHONG can doi schema VOUCHER_SYNC (bang dung chung voi he thong Core, khong duoc phep
 * sua cau truc).
 *
 * Tra ve:
 *  - { duplicate: true } neu da co ban ghi VOUCHER_SYNC khac cho ma nay (phat hien ben trong
 *    khoa, truoc khi goi Core - tranh goi Core mot cach thua thai khi da chac chan trung).
 *  - { duplicate: false, pendingSync, redeemResult, syncErrorMessage } cho moi truong hop con
 *    lai (thanh cong, cho dong bo, hoac Core tu choi nghiep vu - redeemVoucher() o tren tu
 *    doc outcome.redeemResult.success de biet co ghi DB hay khong).
 *
 * Neu buoc INSERT that bai SAU KHI Core da xac nhan thanh cong that su (khong phai do bat
 * loi ket noi Core), loi nem ra duoc gan them err.coreConfirmedSuccess=true de ham goi (C1)
 * biet day la 1 giao dich CO THAT can canh bao khan, khong phai loi thong thuong.
 */
async function redeemAndInsertGuarded({ user, transNum, voucherCode, precheck }) {
  const pool = await getPool();
  // Location_DetailName: tra ten theo LocationCode (Locations_Detail co cot ma ro rang de
  // doi chieu). Location_GroupName KHONG dien duoc tuong tu vi Locations_Group khong co cot
  // ma - de NULL, bao cao/giao dien da co san phuong an du phong hien ma thay ten (xem
  // locationService.js).
  const locationDetailName = await locationService.getDetailNameByCode(user.locationsDetail);

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  let redeemResult = null;
  let pendingSync = false;
  let syncErrorMessage = null;

  try {
    // Gioi han thoi gian cho khoa lon hon timeout goi Core (mac dinh 8s, xem CORE_API_TIMEOUT_MS)
    // vi gio khoa nay phai bao trum ca thoi gian cho Core phan hoi, khong chi buoc ghi DB.
    const lockResult = await transaction
      .request()
      .input('resource', sql.NVarChar(255), `voucher-redeem:${voucherCode}`)
      .query(`
        DECLARE @lockResult INT;
        EXEC @lockResult = sp_getapplock @Resource = @resource, @LockMode = 'Exclusive',
          @LockOwner = 'Transaction', @LockTimeout = 15000;
        SELECT @lockResult AS lockResult;
      `);
    if ((lockResult.recordset[0] || {}).lockResult < 0) {
      throw new Error('Khong lay duoc khoa xu ly voucher (dang co request khac xu ly cung ma nay), vui long thu lai.');
    }

    const existing = await transaction
      .request()
      .input('voucherCode', sql.NVarChar(24), voucherCode)
      .query('SELECT TOP 1 TRANS_NUM FROM dbo.VOUCHER_SYNC WHERE Voucher_Code = @voucherCode');

    if (existing.recordset[0]) {
      await transaction.rollback();
      return { duplicate: true };
    }

    // Goi Core NGAY TRONG khoa (H5) - request thu 2 cung ma se cho o buoc lay khoa phia tren,
    // khong bao gio goi Core dong thoi voi request nay.
    try {
      redeemResult = await coreVoucherService.redeemVoucher(voucherCode, {
        username: user.username,
        locationsGroup: user.locationsGroup,
        locationsDetail: user.locationsDetail,
        transNum,
      });
    } catch (err) {
      pendingSync = true;
      // H7: neu Core THAT SU co phan hoi (chi la xu ly loi, vd sai cau hinh mapping) thay vi
      // hoan toan khong ket noi duoc, ghi ro trong message de admin kiem tra dung huong (cau
      // hinh ket noi) thay vi tuong nham la su co mang tam thoi.
      syncErrorMessage = err.coreUnreachable === false
        ? `${err.message} (Core CO PHAN HOI nhung khong xu ly duoc - kiem tra lai cau hinh ket noi/mapping, khong chi la su co mang)`
        : err.message;
      redeemResult = { success: true, status: 'REDEEMED', transRef: null, redeemedAt: new Date().toISOString() };
    }

    if (!pendingSync && !redeemResult.success) {
      // Core tu choi nghiep vu that su - khong ghi gi ca.
      await transaction.rollback();
      return { duplicate: false, pendingSync, redeemResult, syncErrorMessage };
    }

    const safeValueAmt = sanitizeValueAmt(precheck.valueAmt, { voucherCode, transNum });

    try {
      await transaction
        .request()
        .input('userid', sql.Int, user.userId)
        .input('userName', sql.NChar(60), user.fullName || user.username)
        .input('transNum', sql.Char(18), transNum)
        .input('voucherSerial', sql.NVarChar(100), precheck.voucherSerial || '')
        .input('voucherCode', sql.NVarChar(24), voucherCode)
        .input('status', sql.NVarChar(240), 'REDEEMED')
        .input('computerName', sql.NVarChar(100), 'PARTNER_REDEMPTION_APP')
        .input('locationsGroup', sql.NVarChar(100), user.locationsGroup || '')
        .input('locationsDetail', sql.NVarChar(100), user.locationsDetail || '')
        .input('locationDetailName', sql.NVarChar(200), locationDetailName)
        .input('valueAmt', sql.Numeric(18, 2), safeValueAmt)
        .input('sync', sql.NVarChar(2), pendingSync ? 'N' : 'Y')
        .query(`
          INSERT INTO dbo.VOUCHER_SYNC
            (userid, User_Name, TRANS_NUM, Voucher_Serial, Voucher_Code, Created_Date,
             Status, Computer_name, Locations_Group, Locations_Detail, Location_DetailName, VALUE_AMT,
             Last_update, Sync, Sync_update)
          VALUES
            (@userid, @userName, @transNum, @voucherSerial, @voucherCode, GETDATE(),
             @status, @computerName, @locationsGroup, @locationsDetail, @locationDetailName, @valueAmt,
             GETDATE(), @sync, @sync)
        `);
    } catch (insertErr) {
      // C1: Core CO THE da xac nhan that su (khong phai qua nhanh "pendingSync" do loi ket
      // noi) nhung ghi DB van that bai - danh dau ro de ham goi biet day la giao dich CO THAT.
      if (!pendingSync && redeemResult.success) {
        insertErr.coreConfirmedSuccess = true;
        insertErr.coreTransRef = redeemResult.transRef;
      }
      throw insertErr;
    }

    await transaction.commit();
    return { duplicate: false, pendingSync, redeemResult, syncErrorMessage };
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      // Transaction co the da tu dong rollback (vd loi ket noi) - bo qua loi rollback kep.
    }
    throw err;
  }
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
