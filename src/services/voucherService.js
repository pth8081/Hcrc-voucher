const { sql, getPool } = require('../config/db');
const coreVoucherService = require('./coreVoucherService');
const systemLogService = require('./systemLogService');
const locationService = require('./locationService');
const userVoucherSystemService = require('./userVoucherSystemService');
const apiConnectionService = require('./apiConnectionService');
const { generateTransNum } = require('../utils/transNum');
const guessGuard = require('../utils/guessGuard');
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
 * Kiem tra ma voucher co trung 1 tien to BI LOAI TRU cua ket noi (connectionId, hoac ket noi
 * active neu connectionId rong) hay khong - so khop CHINH XAC tung ky tu bang voucherCode.startsWith(),
 * KHONG phai gan dung/khong phan biet hoa thuong. Tra ve null neu khong trung tien to nao (duoc
 * quet/thu hoi binh thuong), hoac { matchedPrefix, connectionName } neu trung - dung de tu choi
 * NGAY truoc khi goi Core API, xem checkVoucher()/redeemVoucher() ben duoi.
 */
async function checkExclusion(connectionId, voucherCode) {
  const { connectionName, prefixes } = await apiConnectionService.getExclusionConfig(connectionId);
  const matchedPrefix = prefixes.find((p) => voucherCode.startsWith(p));
  return matchedPrefix ? { matchedPrefix, connectionName } : null;
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

    const excluded = await withDiagnostic('kiem tra tien to ma bi loai tru', () => checkExclusion(connectionId, voucherCode));
    if (excluded) {
      guessGuard.recordResult(user.userId, false);
      await logScan({
        user,
        voucherCode,
        scanMethod,
        action: 'CHECK',
        resultStatus: 'EXCLUDED',
        message: `Ma bi loai tru theo cau hinh he thong "${excluded.connectionName || ''}" (trung tien to "${excluded.matchedPrefix}"), khong goi Core API`,
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
  return withUserScanLock(user.userId, async () => {
    const connectionId = await withDiagnostic('xac dinh he thong voucher duoc phep dung', () =>
      resolveAllowedConnectionId(user.userId, requestedConnectionId)
    );

    const excluded = await withDiagnostic('kiem tra tien to ma bi loai tru', () => checkExclusion(connectionId, voucherCode));
    if (excluded) {
      guessGuard.recordResult(user.userId, false);
      await logScan({
        user,
        voucherCode,
        scanMethod,
        action: 'REDEEM',
        resultStatus: 'EXCLUDED',
        clientIp,
        message: `Tu choi thu hoi: ma bi loai tru theo cau hinh he thong "${excluded.connectionName || ''}" (trung tien to "${excluded.matchedPrefix}"), khong goi Core API`,
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
      outcome = await redeemAndInsertGuarded({ user, transNum, voucherCode, precheck, connectionId });
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
async function redeemAndInsertGuarded({ user, transNum, voucherCode, precheck, connectionId }) {
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

module.exports = { checkVoucher, redeemVoucher };
