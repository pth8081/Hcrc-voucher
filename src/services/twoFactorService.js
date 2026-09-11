const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const { sql, getPool } = require('../config/db');
const { encrypt, decrypt } = require('../utils/crypto');

// Cho phep lech 1 buoc (30 giay) truoc/sau de bu dong ho thiet bi khong khop tuyet doi.
authenticator.options = { window: 1 };

const ISSUER = 'HCRC Voucher Redemption';

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.publicMessage = message;
  return err;
}

/**
 * M1: otplib.authenticator.check() chi kiem tra 1 ma con hop le trong window (+-1 buoc, 30s/
 * buoc) - KHONG tu chan viec dung LAI cung 1 ma nhieu lan trong luc con hop le. Ai chan duoc 1
 * ma dung that (qua vai nguoi go, camera giam sat, log...) co the tai su dung trong toi da ~90
 * giay ma khong can biet bi mat TOTP. Dung checkDelta() de biet CHINH XAC buoc thoi gian (counter)
 * ma da khop, luu vao DB (LastUsedCounter, migration 017) va chi cho phep counter TANG (khong
 * lui/dung lai) giua cac lan xac minh cua CUNG 1 tai khoan.
 */
function verifyTotpAndGetCounter(secret, code, lastUsedCounter) {
  if (!secret) throw badRequest('Ma xac thuc khong dung, vui long thu lai.');
  const delta = authenticator.checkDelta(String(code || '').trim(), secret);
  if (delta === null || delta === undefined) {
    throw badRequest('Ma xac thuc khong dung, vui long thu lai.');
  }
  const step = authenticator.options.step || 30;
  const counter = Math.floor(Date.now() / 1000 / step) + delta;
  if (lastUsedCounter != null && counter <= Number(lastUsedCounter)) {
    throw badRequest('Ma xac thuc nay vua duoc su dung, vui long doi sang ma moi tren ung dung xac thuc.');
  }
  return counter;
}

/** Trang thai 2FA cua 1 tai khoan - dung de quyet dinh luong dang nhap (buoc thiet lap hay xac minh). */
async function getStatus(userId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .query('SELECT Enabled, EnabledDate, LastUsedDate FROM dbo.AdminTwoFactor WHERE UserId = @userId');
  const row = result.recordset[0];
  return {
    enabled: !!(row && row.Enabled),
    enabledDate: row ? row.EnabledDate : null,
    lastUsedDate: row ? row.LastUsedDate : null,
  };
}

/**
 * Bat dau (hoac lam lai) thiet lap 2FA cho 1 tai khoan - sinh secret TOTP moi, luu tam voi
 * Enabled=0 cho toi khi xac minh dung ma o buoc setupVerify. Goi lai ham nay truoc khi xac
 * minh xong se THAY secret cu bang secret moi (huy QR/secret truoc do), dung khi doi thiet bi.
 */
async function startSetup(userId, username) {
  const secret = authenticator.generateSecret();
  const otpauthUri = authenticator.keyuri(username, ISSUER, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri);

  const pool = await getPool();
  await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('secretEncrypted', sql.NVarChar(500), encrypt(secret))
    .query(`
      MERGE dbo.AdminTwoFactor AS target
      USING (SELECT @userId AS UserId) AS src
      ON target.UserId = src.UserId
      WHEN MATCHED THEN UPDATE SET SecretEncrypted = @secretEncrypted, Enabled = 0, EnabledDate = NULL,
        ResetByUsername = NULL, ResetDate = NULL
      WHEN NOT MATCHED THEN INSERT (UserId, SecretEncrypted, Enabled, CreatedDate)
        VALUES (@userId, @secretEncrypted, 0, GETDATE());
    `);

  return { qrCodeDataUrl, manualEntryKey: secret, issuer: ISSUER };
}

/**
 * Ghi lai LastUsedCounter theo kieu "CO DIEU KIEN" (UPDATE ... WHERE LastUsedCounter cu VAN
 * con nho hon counter moi, kiem tra rowsAffected) thay vi UPDATE thang - day la 1 dot ra soat
 * doi khang sau phat hien: SELECT (doc LastUsedCounter) roi UPDATE (ghi) la 2 cau lenh RIENG
 * BIET, khong nam trong transaction/khoa nao. Duoi READ COMMITTED (mac dinh SQL Server), 2
 * request gan nhu dong thoi CUNG 1 ma TOTP dung co the CUNG doc duoc gia tri LastUsedCounter cu
 * (truoc khi request kia kip ghi), CUNG tinh ra 1 counter hop le, va CA HAI DEU thanh cong -
 * "1 ma chi dung 1 lan" bi vo hieu hoa dung luc co 2 request chay song song. Dieu kien trong
 * WHERE bien buoc ghi thanh 1 buoc "compare-and-swap" nguyen tu o tang CSDL: request thua cuoc
 * se co rowsAffected=0 (vi luc no chay UPDATE thi LastUsedCounter da bi request thang cuoc doi
 * truoc do), duoc coi la loi thay vi thanh cong gia.
 */
async function persistTotpCounter(userId, counter, extraSetClause) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('counter', sql.BigInt, counter)
    .query(`
      UPDATE dbo.AdminTwoFactor
      SET LastUsedDate = GETDATE(), LastUsedCounter = @counter${extraSetClause || ''}
      WHERE UserId = @userId AND (LastUsedCounter IS NULL OR LastUsedCounter < @counter)
    `);
  if (result.rowsAffected[0] === 0) {
    throw badRequest('Ma xac thuc nay vua duoc su dung, vui long doi sang ma moi tren ung dung xac thuc.');
  }
}

/** Xac minh ma nhap trong luc THIET LAP lan dau (hoac doi thiet bi) - dung xong thi bat Enabled=1. */
async function verifySetup(userId, code) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .query('SELECT SecretEncrypted, LastUsedCounter FROM dbo.AdminTwoFactor WHERE UserId = @userId');
  const row = result.recordset[0];
  if (!row) {
    throw badRequest('Chua bat dau thiet lap xac thuc hai yeu to, vui long tai lai trang.');
  }

  const secret = decrypt(row.SecretEncrypted);
  const counter = verifyTotpAndGetCounter(secret, code, row.LastUsedCounter);
  await persistTotpCounter(userId, counter, ', Enabled = 1, EnabledDate = GETDATE()');
}

/** Xac minh ma nhap trong luc DANG NHAP (2FA da bat san tu truoc). */
async function verifyLogin(userId, code) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .query('SELECT SecretEncrypted, Enabled, LastUsedCounter FROM dbo.AdminTwoFactor WHERE UserId = @userId');
  const row = result.recordset[0];
  if (!row || !row.Enabled) {
    throw badRequest('Tai khoan nay chua thiet lap xac thuc hai yeu to.');
  }

  const secret = decrypt(row.SecretEncrypted);
  const counter = verifyTotpAndGetCounter(secret, code, row.LastUsedCounter);
  await persistTotpCounter(userId, counter);
}

/**
 * Hien lai QR cua secret HIEN TAI (dang bat) de quet them tren 1 thiet bi Authenticator thu 2 -
 * KHONG sinh secret moi (khac han startSetup, ham do se HUY secret/QR cu). Controller phai bat
 * nguoi dung nhap lai mat khau truoc khi goi ham nay, vi day la lo lai 1 bi mat co the dung de
 * tao ma OTP thay ho.
 */
async function showCurrentQr(userId, username) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .query('SELECT SecretEncrypted, Enabled FROM dbo.AdminTwoFactor WHERE UserId = @userId');
  const row = result.recordset[0];
  if (!row || !row.Enabled) {
    throw badRequest('Tai khoan nay chua bat xac thuc hai yeu to.');
  }

  const secret = decrypt(row.SecretEncrypted);
  const otpauthUri = authenticator.keyuri(username, ISSUER, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri);
  return { qrCodeDataUrl, manualEntryKey: secret };
}

/**
 * Mot admin GO xac thuc hai yeu to cua mot admin KHAC (vd: admin do bi mat thiet bi) - de
 * lan dang nhap sau cua nguoi do quay lai trang thai "bat buoc thiet lap lai tu dau". Khong
 * cho phep tu go 2FA cua chinh minh - kiem tra actorUserId !== targetUserId o tang controller.
 */
async function adminResetOther(targetUserId, resetByUsername) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, targetUserId)
    .input('resetBy', sql.NVarChar(100), resetByUsername)
    .query(`
      UPDATE dbo.AdminTwoFactor
      SET Enabled = 0, EnabledDate = NULL, ResetByUsername = @resetBy, ResetDate = GETDATE()
      WHERE UserId = @userId
    `);
  // M3: truoc day tra ve boolean nhung controller khong doc gia tri nay - goi voi 1 admin CHUA
  // TUNG bat 2FA (chua co dong nao trong AdminTwoFactor) van bao thanh cong du khong co gi de
  // go, ghi nham vao Nhat ky quan tri.
  if (result.rowsAffected[0] === 0) {
    throw badRequest('Tai khoan nay chua thiet lap xac thuc hai yeu to, khong co gi de go.');
  }
  return true;
}

/** Danh sach toan bo tai khoan quan tri kem trang thai 2FA - phuc vu man hinh "Bao mat". */
async function listAdminStatus() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT u.UserID AS userId, u.Username AS username, u.FullName AS fullName,
           ISNULL(t.Enabled, 0) AS twoFactorEnabled, t.EnabledDate AS enabledDate,
           t.LastUsedDate AS lastUsedDate, t.ResetByUsername AS resetByUsername, t.ResetDate AS resetDate
    FROM dbo.Users u
    LEFT JOIN dbo.AdminTwoFactor t ON t.UserId = u.UserID
    WHERE u.status = 1
    ORDER BY u.Username ASC
  `);
  return result.recordset;
}

module.exports = {
  getStatus,
  startSetup,
  verifySetup,
  verifyLogin,
  showCurrentQr,
  adminResetOther,
  listAdminStatus,
};
