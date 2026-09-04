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

/** Xac minh ma nhap trong luc THIET LAP lan dau (hoac doi thiet bi) - dung xong thi bat Enabled=1. */
async function verifySetup(userId, code) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .query('SELECT SecretEncrypted FROM dbo.AdminTwoFactor WHERE UserId = @userId');
  const row = result.recordset[0];
  if (!row) {
    throw badRequest('Chua bat dau thiet lap xac thuc hai yeu to, vui long tai lai trang.');
  }

  const secret = decrypt(row.SecretEncrypted);
  if (!secret || !authenticator.check(String(code || '').trim(), secret)) {
    throw badRequest('Ma xac thuc khong dung, vui long thu lai.');
  }

  await pool
    .request()
    .input('userId', sql.Int, userId)
    .query(`
      UPDATE dbo.AdminTwoFactor
      SET Enabled = 1, EnabledDate = GETDATE(), LastUsedDate = GETDATE()
      WHERE UserId = @userId
    `);
}

/** Xac minh ma nhap trong luc DANG NHAP (2FA da bat san tu truoc). */
async function verifyLogin(userId, code) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .query('SELECT SecretEncrypted, Enabled FROM dbo.AdminTwoFactor WHERE UserId = @userId');
  const row = result.recordset[0];
  if (!row || !row.Enabled) {
    throw badRequest('Tai khoan nay chua thiet lap xac thuc hai yeu to.');
  }

  const secret = decrypt(row.SecretEncrypted);
  if (!secret || !authenticator.check(String(code || '').trim(), secret)) {
    throw badRequest('Ma xac thuc khong dung, vui long thu lai.');
  }

  await pool
    .request()
    .input('userId', sql.Int, userId)
    .query('UPDATE dbo.AdminTwoFactor SET LastUsedDate = GETDATE() WHERE UserId = @userId');
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
  return result.rowsAffected[0] > 0;
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

module.exports = { getStatus, startSetup, verifySetup, verifyLogin, adminResetOther, listAdminStatus };
