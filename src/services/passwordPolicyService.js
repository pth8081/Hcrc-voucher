const bcrypt = require('bcryptjs');
const { sql, getPool } = require('../config/db');
const sessionRevalidation = require('../utils/sessionRevalidation');

/**
 * Bat buoc doi mat khau trong LAN DANG NHAP DAU TIEN vao ung dung nay - ap dung cho MOI tai
 * khoan (ca quan tri lan nhan vien), tach biet hoan toan voi 2FA (twoFactorService.js, chi
 * bat buoc rieng cho quan tri). Trang thai luu trong dbo.UserPasswordPolicy (them moi, khong
 * sua dbo.Users) - CHUA CO dong (tai khoan chua tung doi mat khau qua app nay) = MAC DINH bat
 * buoc doi, nen khong can seed du lieu cho tai khoan cu dang co san.
 */

const MIN_LENGTH = 8;
const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.publicMessage = message;
  return err;
}

/** Tra ve danh sach yeu cau CHUA dat duoc (rong = mat khau hop le). */
function checkComplexity(password) {
  const problems = [];
  const value = password || '';
  if (value.length < MIN_LENGTH) problems.push(`it nhat ${MIN_LENGTH} ky tu`);
  if (!/[A-Za-z]/.test(value)) problems.push('it nhat 1 chu cai');
  if (!/[0-9]/.test(value)) problems.push('it nhat 1 chu so');
  if (!SPECIAL_CHAR_REGEX.test(value)) problems.push('it nhat 1 ky tu dac biet (vd: ! @ # $ % _ ...)');
  return problems;
}

function assertComplexity(password) {
  const problems = checkComplexity(password);
  if (problems.length) {
    throw badRequest(`Mat khau moi chua dat yeu cau: ${problems.join(', ')}.`);
  }
}

/** So phien ban mat khau HIEN TAI - nhung vao JWT luc cap phien (issueSession) de doi chieu
 * sau nay (middleware/auth.js), thay cho cach so sanh dong ho cu (xem ghi chu o duoi). Chua
 * co dong (tai khoan chua tung doi mat khau qua app nay) = version goc (1). */
async function getPasswordVersion(userId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .query('SELECT PasswordVersion FROM dbo.UserPasswordPolicy WHERE UserId = @userId');
  const row = result.recordset[0];
  return row ? row.PasswordVersion : 1;
}

/** true = tai khoan nay PHAI doi mat khau truoc khi duoc dung tiep (chua co dong = mac dinh true). */
async function mustChangePassword(userId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .query('SELECT MustChangePassword FROM dbo.UserPasswordPolicy WHERE UserId = @userId');
  const row = result.recordset[0];
  return row ? !!row.MustChangePassword : true;
}

/** Doi mat khau (bam bcrypt) + danh dau da doi - dung cho ca buoc bat buoc lan dau lan chu dong sau nay. */
async function setNewPassword(userId, newPassword) {
  assertComplexity(newPassword);
  const passwordHash = await bcrypt.hash(newPassword, 10);

  const pool = await getPool();
  await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('password', sql.NVarChar(200), passwordHash)
    .query('UPDATE dbo.Users SET Password = @password WHERE UserID = @userId');

  await pool
    .request()
    .input('userId', sql.Int, userId)
    .query(`
      MERGE dbo.UserPasswordPolicy AS target
      USING (SELECT @userId AS UserId) AS src
      ON target.UserId = src.UserId
      WHEN MATCHED THEN UPDATE SET MustChangePassword = 0, PasswordChangedDate = GETDATE(), PasswordVersion = PasswordVersion + 1, UpdatedDate = GETDATE()
      WHEN NOT MATCHED THEN INSERT (UserId, MustChangePassword, PasswordChangedDate, PasswordVersion, UpdatedDate)
        VALUES (@userId, 0, GETDATE(), 1, GETDATE());
    `);
  // H1-noi rong (dot ra soat sau phat hien): truoc day doi chieu bang PasswordChangedDate (dong
  // ho SQL Server) vs "iat" cua JWT (dong ho may chu Node) - 2 DONG HO KHAC NHAU co the LECH
  // NHAU (VM khong dong bo NTP...), tung gay loi THAT: token vua cap NGAY SAU KHI doi mat khau
  // bi coi NHAM la cap TRUOC do, tu choi ngay lap tuc (dang nhap xong bi dang xuat lien tuc,
  // xem sql/025_add_password_version.sql). Gio tang PasswordVersion (so nguyen don gian) va
  // nhung gia tri nay vao JWT luc cap (issueSession) - middleware/auth.js chi can SO SANH SO,
  // khong con phu thuoc dong ho may nao. Van xoa cache ngay lap tuc (khong doi TTL het han) de
  // token cu bi tu choi cang som cang tot.
  sessionRevalidation.invalidate(userId);
}

/** Quan tri DAT LAI mat khau ho 1 tai khoan khac (nut "Sua" o man hinh Tai khoan) - khac
 * setNewPassword() o cho: BUOC tai khoan do phai doi lai mat khau (cua admin dat) trong lan
 * dang nhap tiep theo, thay vi coi nhu da "chinh chu" doi xong. */
async function adminResetPassword(userId, newPassword) {
  assertComplexity(newPassword);
  const passwordHash = await bcrypt.hash(newPassword, 10);

  const pool = await getPool();
  await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('password', sql.NVarChar(200), passwordHash)
    .query('UPDATE dbo.Users SET Password = @password WHERE UserID = @userId');

  await pool
    .request()
    .input('userId', sql.Int, userId)
    .query(`
      MERGE dbo.UserPasswordPolicy AS target
      USING (SELECT @userId AS UserId) AS src
      ON target.UserId = src.UserId
      WHEN MATCHED THEN UPDATE SET MustChangePassword = 1, PasswordChangedDate = GETDATE(), PasswordVersion = PasswordVersion + 1, UpdatedDate = GETDATE()
      WHEN NOT MATCHED THEN INSERT (UserId, MustChangePassword, PasswordChangedDate, PasswordVersion, UpdatedDate)
        VALUES (@userId, 1, GETDATE(), 1, GETDATE());
    `);
  // Dot ra soat sau phat hien: mat khau THAT SU da doi tai day (admin dat lai ho) nhung truoc day
  // KHONG ghi PasswordChangedDate (chi setNewPassword co) va KHONG lam mat hieu luc token cu -
  // token dang nhap DA CAP TRUOC do (vd bi lo, ly do chinh admin phai dat lai mat khau ho) van
  // dung duoc binh thuong toi het han. Tang PasswordVersion (xem ghi chu o setNewPassword ve ly
  // do dung so thay vi dong ho) va xoa cache ngay, cung 1 co che voi setNewPassword() o tren.
  sessionRevalidation.invalidate(userId);
}

module.exports = { checkComplexity, assertComplexity, mustChangePassword, getPasswordVersion, setNewPassword, adminResetPassword };
