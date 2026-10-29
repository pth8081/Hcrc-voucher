const { sql, getPool } = require('../config/db');
const coreVoucherService = require('./coreVoucherService');
const systemLogService = require('./systemLogService');
const locationService = require('./locationService');
const userVoucherSystemService = require('./userVoucherSystemService');
const apiConnectionService = require('./apiConnectionService');
const { generateTransNum } = require('../utils/transNum');
const guessGuard = require('../utils/guessGuard');
const redeemRateLimit = require('../utils/redeemRateLimit');
const { SYNC_PROC_NAME } = require('../utils/syncConstants');

const { VOUCHER_STATUS } = coreVoucherService;

/**
 * Doi chieu `connectionId` nguoi dung gui len (co the de trong) voi danh sach he thong voucher
 * TAI KHOAN DO duoc phep dung (xem userVoucherSystemService.js) - BAT BUOC kiem tra lai o server,
 * khong the chi dua vao o chon tren man hinh Quet voucher (client co the bi sua/bo qua). Tra ve
 * connectionId THAT SU se dung (co the khac voi gia tri nguoi dung gui, neu ho chi duoc dung
 * dung 1 he thong va khong gui gi ca).
 */
async function resolveAllowedConnectionId(userId, requestedConnectionId) {
  const allowedRaw = await userVoucherSystemService.getAllowedConnectionIds(userId);
  if (allowedRaw === null) return requestedConnectionId; // khong gioi han - giu nguyen lua chon (hoac null = dung ket noi active mac dinh)

  // M15: "Khac" (UNTAGGED_CONNECTION_ID) chi co y nghia khi XEM BAO CAO (danh dau duoc phep
  // thay du lieu cu), KHONG phai 1 he thong that co the chon de quet/thu hoi - loai bo truoc khi
  // ap dung logic chon ket noi o day, tranh truong hop 1 tai khoan CHI duoc tick "Khac" (khong
  // tick he thong that nao) bi coi la "chi co dung 1 lua chon" roi tu dong dung ConnectionId=0
  // de goi Core (se loi "khong tim thay he thong" vi khong co ket noi that nao mang Id nay).
  const allowed = allowedRaw.filter((id) => id !== userVoucherSystemService.UNTAGGED_CONNECTION_ID);

  if (!allowed.length) {
    const err = new Error('Tai khoan chua duoc cap quyen dung he thong voucher nao');
    err.statusCode = 403;
    err.publicMessage = 'Tai khoan cua ban chua duoc cap quyen su dung he thong voucher nao, vui long lien he quan tri vien.';
    throw err;
  }
  if (requestedConnectionId) {
    if (!allowed.includes(Number(requestedConnectionId))) {
      const err = new Error('Khong co quyen dung he thong voucher nay');
      err.statusCode = 403;
      err.publicMessage = 'Tai khoan cua ban khong co quyen su dung he thong voucher da chon.';
      throw err;
    }
    return requestedConnectionId;
  }
  if (allowed.length === 1) return allowed[0];
  const err = new Error('Can chon ro he thong voucher');
  err.statusCode = 400;
  err.publicMessage = 'Tai khoan cua ban duoc dung nhieu he thong voucher - vui long chon ro he thong truoc khi quet.';
  throw err;
}

/**
 * Kiem tra ma voucher co bi CHAN boi cau hinh loc tien to cua ket noi (connectionId, hoac ket noi
 * active neu connectionId rong) hay khong - 2 che do loai tru nhau (xem apiConnectionService.js):
 * EXCLUDE (blacklist, mac dinh) - chan ma trung 1 trong cac tien to BI LOAI TRU; INCLUDE
 * (whitelist) - chan ma KHONG trung bat ky tien to nao trong danh sach DUOC CHAP NHAN. So khop
 * CHINH XAC tung ky tu bang voucherCode.startsWith(), KHONG phai gan dung/khong phan biet hoa
 * thuong. Tra ve null neu khong bi chan (duoc quet/thu hoi binh thuong), hoac thong tin ly do chan
 * - dung de tu choi NGAY truoc khi goi Core API, xem checkVoucher()/redeemVoucher() ben duoi.
 */
async function checkPrefixFilter(connectionId, voucherCode) {
  const config = await apiConnectionService.getPrefixFilterConfig(connectionId);
  const blocked = apiConnectionService.matchPrefixFilter(config, voucherCode);
  if (!blocked) return null;
  return { ...blocked, connectionName: config.connectionName };
}

/** Dong log mo ta ly do bi chan (dung chung cho checkVoucher/redeemOneVoucher) - xem checkPrefixFilter(). */
function describePrefixFilterBlock(blocked) {
  const connName = blocked.connectionName || '';
  if (blocked.mode === 'INCLUDE') {
    return `Ma khong trung tien to nao duoc chap nhan theo cau hinh he thong "${connName}" (danh sach chap nhan: "${blocked.allowedPrefixes.join(', ')}"), khong goi Core API`;
  }
  return `Ma bi loai tru theo cau hinh he thong "${connName}" (trung tien to "${blocked.matchedPrefix}"), khong goi Core API`;
}

/**
 * Dot ra soat sau phat hien (bao cao nguoi dung: quet that bao "Da xay ra loi he thong" chung
 * chung, KHONG goi duoc toi Core (khong co dong nao trong log goi Core) VA KHONG ghi duoc vao
 * Nhat ky he thong (khong co dong nao trong VoucherScanLogs) - nghia la loi xay ra o 1 trong cac
 * buoc CHUAN BI truoc khi goi Core (vd truy van CSDL that bai do thieu migration/sai schema...),
 * nhung cac buoc nay truoc day KHONG gan publicMessage khi gap loi CHUA duoc phan loai, nen roi
 * thang vao nhanh 500 chung chung cua errorHandler.js - nguoi dung (va ca admin, neu khong co
 * quyen xem log server/console) khong co cach nao biet LOI GI de bao cho dung huong.
 *
 * Boc MOI buoc chuan bi (truoc khi goi Core) bang ham nay: gan publicMessage neu loi CHUA duoc
 * phan loai tu truoc (vd loi nghiep vu nhu "chua duoc cap quyen he thong nao" da tu gan san
 * publicMessage roi, KHONG bi ghi de o day) - de toast hien thi dung nguyen nhan that (ten loi
 * CSDL, cau truy van nao that bai...) thay vi chi "Da xay ra loi he thong".
 */
async function withDiagnostic(stepLabel, fn) {
  try {
    return await fn();
  } catch (err) {
    if (!err.publicMessage) {
      err.publicMessage = `Loi o buoc chuan bi "${stepLabel}" (truoc khi goi Core API, chua tieu thu ma voucher): ${err.message}`;
    }
    throw err;
  }
}

/**
 * M18: khoa THEO TAI KHOAN (userId) - dam bao 1 tai khoan CHI co DUNG 1 luot quet/thu hoi dang
 * xu ly tai 1 thoi diem; request thu 2 cho CUNG tai khoan nay (vd dang nhap dong thoi tren 2
 * thiet bi/tab, quet 2 ma KHAC NHAU gan nhu cung luc) bi TU CHOI NGAY (@LockTimeout=0, khong xep
 * hang cho) thay vi xu ly song song.
 *
 * KHAC voi khoa theo ma voucher (sp_getapplock rieng trong redeemAndInsertGuarded, @LockTimeout
 * =15000 - XEP HANG cho toi 15s, muc dich tranh 2 NGUOI khac nhau trung 1 ma): khoa nay muc dich
 * khac han - phat hien 1 TAI KHOAN dang bi dung sai quy trinh (nhieu noi dung chung 1 tai khoan
 * quet dong thoi), nen tu choi THANG thay vi cho.
 *
 * Dung 1 transaction RIENG CHI de giu khoa (@LockOwner='Transaction' tu dong nha khi commit/
 * rollback, AN TOAN voi connection pool - khac han @LockOwner='Session' se "ro ri" khoa sang
 * request khac lo dung lai connection vua tra ve pool) - HOAN TOAN doc lap voi cac
 * truy van/transaction KHAC ben trong `fn()` (vd transaction rieng cua redeemAndInsertGuarded),
 * chi bao ngoai ve THOI GIAN chay, khong lien quan gi ve du lieu.
 */
async function withUserScanLock(userId, fn) {
  const pool = await getPool();
  const lockTx = new sql.Transaction(pool);
  await lockTx.begin();

  const lockResult = await lockTx
    .request()
    .input('resource', sql.NVarChar(255), `user-scan:${userId}`)
    .query(`
      DECLARE @lockResult INT;
      EXEC @lockResult = sp_getapplock @Resource = @resource, @LockMode = 'Exclusive',
        @LockOwner = 'Transaction', @LockTimeout = 0;
      SELECT @lockResult AS lockResult;
    `);

  if ((lockResult.recordset[0] || {}).lockResult < 0) {
    await lockTx.rollback();
    const err = new Error(`Tai khoan userId=${userId} dang co 1 luot quet/thu hoi khac chua xu ly xong`);
    err.statusCode = 429;
    err.publicMessage =
      'Tai khoan cua ban dang quet/thu hoi 1 ma khac (co the dang dang nhap dong thoi o thiet bi khac) - vui long doi hoan tat truoc khi quet ma tiep theo.';
    throw err;
  }

  try {
    return await fn();
  } finally {
    try {
      await lockTx.commit();
    } catch (releaseErr) {
      // eslint-disable-next-line no-console
      console.error(`[withUserScanLock] Giai phong khoa that bai cho userId=${userId}: ${releaseErr.message}`);
    }
  }
}

// Mui gio Viet Nam (+7, khong co gio mua he) - dung de tinh "hom nay" doc lap voi mui gio thuc
// te cua may chu dang chay Node (co the la UTC tuy ha tang trien khai).
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Kiem tra DOC LAP (khong phu thuoc Core) xem `expiryDate` Core tra ve da qua han hay chua -
 * thuc te xac nhan Core (he thong D.Smart) KHONG tu chan voucher qua han o truong `status`
 * (status van = UNUSED du expiryDate da o qua khu hang chuc ngay - kiem tra that qua "Test kiem
 * tra" tren voucher that), nen app PHAI tu kiem tra, khong the tin hoan toan vao status.
 *
 * Gia tri Core tra ve luon la 1 thoi diem 00:00:00 kem hau to "Z" (vd "2026-09-29T00:00:00.000Z")
 * nhung THUC CHAT la "ngay het han" tinh theo gio Viet Nam (da doi chieu voi du lieu DB goc,
 * cot DUE_DATE kieu datetime, gio server Core la +07:00) - Core dang serialize SAI (gan "Z" ma
 * khong thuc su quy doi ve UTC that), KHONG phai 1 thoi diem UTC chinh xac. De tranh phu thuoc
 * vao loi quy doi mui gio nay, CHI so sanh cap **NGAY** (bo qua gio/mui gio hoan toan): doc truc
 * tiep Nam/Thang/Ngay UTC co trong chuoi (dung dung con so Core gui, khong quy doi gi them) va
 * so voi "hom nay" tinh theo gio VN (+7) - con dung duoc DEN HET ngay ghi tren expiryDate, qua
 * ngay hom sau moi coi la het han.
 *
 * Tra ve false (CHUA het han / khong chan) neu thieu expiryDate hoac khong doc duoc - AN TOAN
 * THEO HUONG KHONG CHAN NHAM (Core van la nguon xac nhan chinh cho trang thai UNUSED/USED, kiem
 * tra nay chi la 1 lop phong ho THEM, khong thay the).
 */
function isExpiredByDate(expiryDateStr) {
  if (!expiryDateStr) return false;
  const expiry = new Date(expiryDateStr);
  if (Number.isNaN(expiry.getTime())) return false;
  const expiryDayMs = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate());

  const nowVn = new Date(Date.now() + VN_OFFSET_MS);
  const todayDayMs = Date.UTC(nowVn.getUTCFullYear(), nowVn.getUTCMonth(), nowVn.getUTCDate());

  return todayDayMs > expiryDayMs;
}

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
async function checkVoucher({ voucherCode, user, scanMethod, connectionId: requestedConnectionId }) {
  guessGuard.assertNotLocked(user.userId);
  return withUserScanLock(user.userId, async () => {
    const connectionId = await withDiagnostic('xac dinh he thong voucher duoc phep dung', () =>
      resolveAllowedConnectionId(user.userId, requestedConnectionId)
    );

    const excluded = await withDiagnostic('kiem tra cau hinh loc tien to ma', () => checkPrefixFilter(connectionId, voucherCode));
    if (excluded) {
      guessGuard.recordResult(user.userId, false);
      await logScan({
        user,
        voucherCode,
        scanMethod,
        action: 'CHECK',
        resultStatus: 'EXCLUDED',
        message: describePrefixFilterBlock(excluded),
        connectionName: excluded.connectionName,
      });
      return {
        canRedeem: false,
        status: 'EXCLUDED',
        message: 'Ma voucher nay khong hop le cho he thong dang chon.',
      };
    }

    const localRedeemed = await withDiagnostic('tra cuu da thu hoi cuc bo (VOUCHER_SYNC)', () => findLocalRedemption(voucherCode));
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

    const result = await coreVoucherService.checkVoucher(voucherCode, { connectionId });
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
      connectionName: result.connectionName,
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

    // Core bao UNUSED nhung kiem tra DOC LAP tai app phat hien da qua han (xem isExpiredByDate) -
    // Core (D.Smart) khong tu chan truong hop nay, app phai tu chan them.
    if (isExpiredByDate(result.expiryDate)) {
      await logScan({
        user,
        voucherCode,
        scanMethod,
        action: 'CHECK',
        resultStatus: VOUCHER_STATUS.EXPIRED,
        valueAmt: result.valueAmt,
        expiryDate: result.expiryDate,
        issueDate: result.issueDate,
        message: `Core bao UNUSED nhung da qua han su dung (expiryDate=${result.expiryDate}) - app tu chan theo kiem tra doc lap, khong goi tiep thu hoi`,
        connectionName: result.connectionName,
      });
      return {
        canRedeem: false,
        status: VOUCHER_STATUS.EXPIRED,
        message: 'Voucher nay da het han su dung. Vui long quet ma voucher khac.',
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
  });
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
async function redeemVoucher({ voucherCode, user, scanMethod, clientIp, connectionId: requestedConnectionId }) {
  guessGuard.assertNotLocked(user.userId);
  redeemRateLimit.assertNotLocked(user.userId);
  return withUserScanLock(user.userId, () =>
    redeemOneVoucher({ voucherCode, user, scanMethod, clientIp, connectionId: requestedConnectionId })
  );
}

/**
 * Phan "loi" thuc su cua redeemVoucher() - xu ly DUNG 1 ma voucher, KHONG tu khoa
 * (withUserScanLock)/KHONG tu kiem tra guessGuard/redeemRateLimit o day. Tach rieng de
 * redeemVoucherBatch() (quet nhieu - thu hoi 1 lan, xem ben duoi) goi lai duoc NHIEU LAN
 * ben trong CUNG 1 lan giu khoa user-scan (khong the goi lai redeemVoucher() cho tung ma
 * trong 1 vong lap - withUserScanLock dung 1 transaction/ket noi RIENG moi lan goi (xem ghi
 * chu cua no), nen goi long nhau se bi chinh no tu choi vi nhin tu goc SQL Server la 2 "session"
 * khac nhau dang tranh chap cung 1 khoa, du cung 1 tai khoan/1 request logic).
 */
async function redeemOneVoucher({ voucherCode, user, scanMethod, clientIp, connectionId: requestedConnectionId, invoiceNumber }) {
  {
    const connectionId = await withDiagnostic('xac dinh he thong voucher duoc phep dung', () =>
      resolveAllowedConnectionId(user.userId, requestedConnectionId)
    );

    const excluded = await withDiagnostic('kiem tra cau hinh loc tien to ma', () => checkPrefixFilter(connectionId, voucherCode));
    if (excluded) {
      guessGuard.recordResult(user.userId, false);
      await logScan({
        user,
        voucherCode,
        scanMethod,
        action: 'REDEEM',
        resultStatus: 'EXCLUDED',
        clientIp,
        message: `Tu choi thu hoi: ${describePrefixFilterBlock(excluded)}`,
        connectionName: excluded.connectionName,
      });
      return {
        success: false,
        status: 'EXCLUDED',
        message: 'Ma voucher nay khong hop le cho he thong dang chon.',
      };
    }

    // Kiem tra lai ngay truoc khi tieu de tranh doi tac bam xac nhan sau khi da co nguoi khac tieu truoc.
    // Buoc nay BAT BUOC phai goi duoc Core (khong co no thi khong biet voucher con hop le hay khong),
    // nen loi ket noi o day van chan giao dich nhu cu, KHONG dua vao hang doi.
    const precheck = await coreVoucherService.checkVoucher(voucherCode, { connectionId });
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
        connectionName: precheck.connectionName,
      });
      return {
        success: false,
        status: precheck.status,
        // C3: uu tien ly do THAT tu Core (vd thong bao 429 "dang gioi han, cho X giay") thay vi
        // luon ghi co dinh "da doi trang thai" - sai lech neu ly do that khac (gioi han goi, Core
        // tra ve loi khac...), dung lai thong bao cu chi khi Core khong cho biet ly do gi ca.
        message: precheck.message || 'Voucher da doi trang thai, vui long quet lai truoc khi thu hoi.',
      };
    }

    // Core bao UNUSED nhung kiem tra DOC LAP tai app phat hien da qua han - xem ghi chu chi tiet
    // o checkVoucher()/isExpiredByDate(). Chan o day la lop phong ho THEM (ngoai buoc da chan o
    // checkVoucher()), phong truong hop goi thang API thu hoi ma bo qua buoc kiem tra tren giao dien.
    if (isExpiredByDate(precheck.expiryDate)) {
      await logScan({
        user,
        voucherCode,
        scanMethod,
        action: 'REDEEM',
        resultStatus: VOUCHER_STATUS.EXPIRED,
        clientIp,
        valueAmt: precheck.valueAmt,
        expiryDate: precheck.expiryDate,
        message: `Tu choi thu hoi: Core bao UNUSED nhung da qua han su dung (expiryDate=${precheck.expiryDate}) - app tu chan theo kiem tra doc lap`,
        connectionName: precheck.connectionName,
      });
      return {
        success: false,
        status: VOUCHER_STATUS.EXPIRED,
        message: 'Voucher nay da het han su dung. Vui long quet ma voucher khac.',
      };
    }

    const transNum = generateTransNum();

    let outcome;
    try {
      outcome = await redeemAndInsertGuarded({ user, transNum, voucherCode, precheck, connectionId, invoiceNumber });
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
            connectionName: precheck.connectionName,
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
        connectionName: precheck.connectionName,
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
        connectionName: precheck.connectionName,
      });
      return {
        success: false,
        status: outcome.redeemResult.status,
        message: outcome.redeemResult.message || 'Thu hoi voucher that bai, vui long quet ma khac.',
      };
    }

    const { pendingSync, redeemResult, syncErrorMessage } = outcome;

    // M19: CHI dem lan THU HOI THAT SU THANH CONG (toi day la chac chan thanh cong - duplicate/
    // that bai da return som o tren) vao bo dem gioi han toc do (redeemRateLimit.js) - khong tinh
    // cac lan bi tu choi/loi, tranh phat nham 1 tai khoan dang bi loi he thong lien tuc (khong
    // phai hanh vi gian lan).
    redeemRateLimit.recordSuccess(user.userId);

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
      connectionName: precheck.connectionName,
    });

    return {
      success: true,
      status: pendingSync ? 'REDEEMED_PENDING_SYNC' : 'REDEEMED',
      pendingSync,
      transNum,
      valueAmt: precheck.valueAmt,
      redeemedAt: redeemResult.redeemedAt,
      connectionName: precheck.connectionName,
    };
  }
}

// Gioi han so ma toi da trong 1 lan "Thu hoi tat ca" (che do Quet nhieu) - chan bo gio han thoi
// gian giu khoa user-scan (ca lo xu ly tuan tu BEN TRONG 1 lan giu khoa, xem redeemVoucherBatch)
// va khop voi nguong gioi han toc do mac dinh (REDEEM_RATE_LIMIT_MAX=20/phut, xem redeemRateLimit.js) -
// 1 lo qua lon se tu dong bi cham giua chung boi chinh co che chong gian lan nay.
const MAX_BATCH_SIZE = 20;

/**
 * "Quet nhieu - Thu hoi 1 lan": nhan 1 danh sach ma voucher (da quet/kiem tra truoc do o man
 * hinh, con UNUSED tai thoi diem quet), xu ly THU HOI THAT tuan tu TUNG MA MOT trong CUNG 1 lan
 * giu khoa user-scan (xem redeemOneVoucher() o tren) - Core Voucher API khong co san 1 API thu
 * hoi hang loat nen ban chat van la N lan goi rieng le, chi gop lai o 1 request/1 khoa duy nhat.
 *
 * KHONG the "tat ca hoac khong gi ca" (atomic): mot khi 1 ma da goi Core thanh cong THAT SU,
 * khong the hoan tac (Core khong co API "huy thu hoi") - nen xu ly theo kieu "tiep tuc du co
 * loi": 1 ma loi (da bi tieu truoc, mat mang...) CHI lam ma do that bai, KHONG dung ca lo, cac ma
 * con lai van duoc xu ly binh thuong. Tra ve ket qua RIENG cho TUNG ma (voucherCode, success,
 * status, message...) de giao dien tu tinh lai tong THUC THU (chi tinh ma success/pendingSync).
 *
 * Kiem tra lai guessGuard/redeemRateLimit TRUOC MOI ma (khong chi 1 lan dau) - neu 1 trong 2 co
 * che nay kich hoat GIUA chung lo (vd lo 20 ma dung dung nguong toc do, hoac qua nhieu ma khong
 * hop le lien tiep trong lo), CAC MA CON LAI dung xu ly ngay (khong goi Core nua), danh dau ro
 * "SKIPPED" kem ly do - tranh tiep tuc goi Core khi da biet chac se bi tu choi.
 */
// So hoa don (v3.80): TUY CHON, thuoc he thong ban hang RIENG cua doi tac (app nay khong tich
// hop gi voi he thong do, chi luu lai THEO YEU CAU nguoi dung de doi chieu sau nay) - dung
// CHUNG 1 gia tri cho CA LO (1 khach thanh toan gop nhieu voucher = 1 hoa don). Gioi han do dai
// khop dung cot VoucherRedemptionInvoices.InvoiceNumber (nvarchar(50), sql/039).
const MAX_INVOICE_NUMBER_LEN = 50;
function sanitizeInvoiceNumber(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  return trimmed ? trimmed.slice(0, MAX_INVOICE_NUMBER_LEN) : null;
}

async function redeemVoucherBatch({ voucherCodes, user, scanMethod, clientIp, connectionId, invoiceNumber: rawInvoiceNumber }) {
  if (!Array.isArray(voucherCodes) || !voucherCodes.length) {
    const err = new Error('Danh sach ma voucher rong');
    err.statusCode = 400;
    err.publicMessage = 'Chua co voucher nao trong danh sach de thu hoi.';
    throw err;
  }
  const invoiceNumber = sanitizeInvoiceNumber(rawInvoiceNumber);

  // Loai trung (giu dung ma QUET DAU TIEN, bo cac lan quet trung lap sau do trong cung 1 lo) +
  // chan toi da MAX_BATCH_SIZE ma - KHONG bao loi khi vuot qua, chi lay dung MAX_BATCH_SIZE ma
  // DAU TIEN va bo qua phan con lai (giao dien da chan tu truoc o client, day la lop phong ho
  // them o server, khong can lam gian doan nguoi dung voi 1 loi kho hieu).
  const seen = new Set();
  const codes = [];
  for (const raw of voucherCodes) {
    const code = String(raw || '').trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
    if (codes.length >= MAX_BATCH_SIZE) break;
  }
  if (!codes.length) {
    const err = new Error('Danh sach ma voucher rong sau khi loc');
    err.statusCode = 400;
    err.publicMessage = 'Chua co voucher hop le nao trong danh sach de thu hoi.';
    throw err;
  }

  guessGuard.assertNotLocked(user.userId);
  redeemRateLimit.assertNotLocked(user.userId);

  return withUserScanLock(user.userId, async () => {
    const results = [];
    let skipRemaining = null;

    for (const voucherCode of codes) {
      if (skipRemaining) {
        results.push({ voucherCode, success: false, status: 'SKIPPED', message: skipRemaining });
        continue;
      }

      try {
        guessGuard.assertNotLocked(user.userId);
        redeemRateLimit.assertNotLocked(user.userId);
      } catch (guardErr) {
        skipRemaining = guardErr.publicMessage || guardErr.message;
        results.push({ voucherCode, success: false, status: 'SKIPPED', message: skipRemaining });
        continue;
      }

      try {
        const outcome = await redeemOneVoucher({ voucherCode, user, scanMethod, clientIp, connectionId, invoiceNumber });
        results.push({ voucherCode, ...outcome });
      } catch (err) {
        // Boc loi tung ma rieng le (ke ca loi CRITICAL "Core da xac nhan nhung ghi DB that bai" -
        // da duoc ghi canh bao/log day du BEN TRONG redeemOneVoucher/redeemAndInsertGuarded truoc
        // khi throw) - KHONG de 1 ma loi lam sap ca response, cac ma con lai van duoc xu ly tiep.
        results.push({ voucherCode, success: false, status: 'ERROR', message: err.publicMessage || err.message });
      }
    }

    return results;
  });
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

// Do rong THAT cua cac cot string trong VOUCHER_SYNC (bang Core cu, KHONG duoc doi cau truc) -
// xac nhan TRUC TIEP qua INFORMATION_SCHEMA.COLUMNS tren production (dot ra soat sau loi that
// "String or binary data would be truncated" voi 1 ma Fuji 13 ky tu) - HEP HON NHIEU so voi cac
// gia tri sql.NChar/NVarChar(...) app tung khai bao o INSERT phia duoi (do chi la "y dinh" phia
// client luc dau, khong phai do rong CỘT THẬT - SQL Server van tu choi neu gia tri thuc te vuot
// qua do rong that). Nguyen nhan cu the da xac nhan: ma QUET cua doi tac (vd Fuji) co dang
// "C" + serial (vd "CE21000044090", 13 ky tu) - serial Core tra ve o truong voucherSerial
// ("E21000044090") CHI 12 ky tu, chu "C" them o dau chi la quy uoc in/quet VAT LY cua doi tac,
// khong phai 1 phan cua serial goc trong Core (doi chieu du lieu HCRC that: cot "MÃ VOUCHER"
// tren bao cao luon dang "E..." 12 ky tu, KHONG BAO GIO co "C" - vi ma quet cua HCRC von di da
// khong co tien to nay, nen chua bao gio gap loi tran cot). Them 3 cot khac cung co cung kieu
// loi tiem an (app khai bao rong hon that, chua tung kich hoat vi du lieu thuc te tinh co van
// vua, nhung van la 1 qua bom hen gio) - sua dong bo luon, khong doi den khi gap loi moi vá tiep.
const VOUCHER_SYNC_REAL_WIDTH = {
  userName: 30, // User_Name nchar(30) - app tung khai bao NChar(60)
  voucherSerial: 50, // Voucher_Serial nvarchar(50) - app tung khai bao NVarChar(100)
  voucherCode: 12, // Voucher_Code nvarchar(12) - app tung khai bao NVarChar(24)
  locationsGroup: 50, // Locations_Group nvarchar(50) - app tung khai bao NVarChar(100)
  locationsDetail: 50, // Locations_Detail nvarchar(50) - app tung khai bao NVarChar(100)
  locationDetailName: 100, // Location_DetailName nvarchar(100) - app tung khai bao NVarChar(200)
};

/** Cat gia tri ve DUNG do rong cot that truoc khi ghi VOUCHER_SYNC, canh bao ro trong log neu
 * thuc su phai cat bot (de admin biet ma theo doi/kiem tra lai nguon du lieu, khong am tham mat
 * thong tin ma khong ai hay biet). `allowNull`: giu nguyen NULL thay vi ep thanh chuoi rong (dung
 * cho locationDetailName - tai khoan chua gan diem tieu la tinh huong binh thuong, khac voi "co
 * gia tri nhung qua dai"). */
function truncateForSync(value, fieldKey, { voucherCode, transNum, allowNull = false } = {}) {
  if (allowNull && (value === null || value === undefined)) return null;
  const maxLen = VOUCHER_SYNC_REAL_WIDTH[fieldKey];
  const str = String(value || '').trim();
  if (str.length > maxLen) {
    // eslint-disable-next-line no-console
    console.warn(`[voucherService] Gia tri ghi vao VOUCHER_SYNC.${fieldKey} ("${str}") dai hon do rong cot that (${maxLen} ky tu) cho voucher ${voucherCode} (transNum ${transNum}) - da CAT CON ${maxLen} ky tu dau de tranh loi SQL, can kiem tra lai nguon du lieu (ten dai qua muc thong thuong?).`);
  }
  return str.slice(0, maxLen);
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
async function redeemAndInsertGuarded({ user, transNum, voucherCode, precheck, connectionId, invoiceNumber }) {
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

    // Doi chieu trung ma PHAI dung CUNG 1 gia tri se duoc GHI vao Voucher_Code o duoi (xem
    // truncateForSync) - neu so sanh bang ma quet goc (voucherCode, co the dai hon 12 ky tu) se
    // KHONG BAO GIO khop voi gia tri da cat ngan dang luu, lam mat tac dung chong trung hoan
    // toan cho cac he thong co ma quet dang "C" + serial (vd Fuji). Uu tien voucherSerial Core
    // tra ve (da xac nhan la gia tri dung - xem ghi chu VOUCHER_SYNC_REAL_WIDTH o tren), chi
    // fallback ve ma quet goc neu Core khong tra ve serial.
    const syncVoucherCode = truncateForSync(precheck.voucherSerial || voucherCode, 'voucherCode', { voucherCode, transNum });
    const existing = await transaction
      .request()
      .input('voucherCode', sql.NVarChar(VOUCHER_SYNC_REAL_WIDTH.voucherCode), syncVoucherCode)
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
        connectionId,
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
        .input('userName', sql.NChar(VOUCHER_SYNC_REAL_WIDTH.userName), truncateForSync(user.fullName || user.username, 'userName', { voucherCode, transNum }))
        .input('transNum', sql.Char(18), transNum)
        .input('voucherSerial', sql.NVarChar(VOUCHER_SYNC_REAL_WIDTH.voucherSerial), truncateForSync(precheck.voucherSerial, 'voucherSerial', { voucherCode, transNum }))
        .input('voucherCode', sql.NVarChar(VOUCHER_SYNC_REAL_WIDTH.voucherCode), syncVoucherCode)
        .input('status', sql.NVarChar(240), 'REDEEMED')
        .input('computerName', sql.NVarChar(100), 'PARTNER_REDEMPTION_APP')
        .input('locationsGroup', sql.NVarChar(VOUCHER_SYNC_REAL_WIDTH.locationsGroup), truncateForSync(user.locationsGroup, 'locationsGroup', { voucherCode, transNum }))
        .input('locationsDetail', sql.NVarChar(VOUCHER_SYNC_REAL_WIDTH.locationsDetail), truncateForSync(user.locationsDetail, 'locationsDetail', { voucherCode, transNum }))
        .input('locationDetailName', sql.NVarChar(VOUCHER_SYNC_REAL_WIDTH.locationDetailName), truncateForSync(locationDetailName, 'locationDetailName', { voucherCode, transNum, allowNull: true }))
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

      // Ghi lai he thong voucher (connectionId/connectionName) da xu ly giao dich nay, khoa theo
      // TRANS_NUM - CUNG transaction voi INSERT VOUCHER_SYNC o tren, de 2 ban ghi luon nhat quan
      // voi nhau. Can thiet de syncRetryService.js biet goi lai DUNG he thong khi giao dich nay
      // dang "cho dong bo" (xem sql/027_create_voucher_redemption_connections.sql).
      await transaction
        .request()
        .input('transNum', sql.Char(18), transNum)
        .input('connectionId', sql.Int, connectionId || null)
        .input('connectionName', sql.NVarChar(100), redeemResult.connectionName || null)
        .query(`
          INSERT INTO dbo.VoucherRedemptionConnections (TransNum, ConnectionId, ConnectionName)
          VALUES (@transNum, @connectionId, @connectionName)
        `);

      // So hoa don (v3.80, TUY CHON): CUNG transaction voi 2 INSERT o tren, de nhat quan - chi
      // ghi khi nguoi dung THAT SU co dien (xem sanitizeInvoiceNumber() - null = khong dien gi).
      // Bang rieng cua app, khong dung cham VOUCHER_SYNC (xem sql/039).
      if (invoiceNumber) {
        await transaction
          .request()
          .input('transNum', sql.Char(18), transNum)
          .input('invoiceNumber', sql.NVarChar(MAX_INVOICE_NUMBER_LEN), invoiceNumber)
          .query(`
            INSERT INTO dbo.VoucherRedemptionInvoices (TransNum, InvoiceNumber)
            VALUES (@transNum, @invoiceNumber)
          `);
      }
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
  connectionName,
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
    // He thong voucher (ten ket noi ApiConnections, vd "BRGmart"/"Fuji") da xu ly lan quet nay -
    // xem sql/026_add_connection_to_scan_logs.sql. null khi app chi dung fallback .env cu (chua
    // cau hinh ket noi nao) - khong co "ten he thong" nao de ghi trong truong hop do.
    .input('connectionName', sql.NVarChar(100), connectionName || null)
    .query(`
      INSERT INTO dbo.VoucherScanLogs
        (UserId, UserName, LocationsGroup, LocationsDetail, VoucherCode, ScanMethod,
         Action, ResultStatus, ValueAmt, VoucherExpiryDate, VoucherIssueDate,
         CoreApiHttpStatus, CoreApiMessage, ClientIp, ConnectionName, CreatedDate)
      VALUES
        (@userId, @userName, @locationsGroup, @locationsDetail, @voucherCode, @scanMethod,
         @action, @resultStatus, @valueAmt, @expiryDate, @issueDate,
         @httpStatus, @message, @clientIp, @connectionName, GETDATE())
    `);
}

module.exports = { checkVoucher, redeemVoucher, redeemVoucherBatch, MAX_BATCH_SIZE };
