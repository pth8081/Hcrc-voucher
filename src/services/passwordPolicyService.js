const bcrypt = require('bcryptjs');
const { sql, getPool } = require('../config/db');

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
      WHEN MATCHED THEN UPDATE SET MustChangePassword = 0, PasswordChangedDate = GETDATE(), UpdatedDate = GETDATE()
      WHEN NOT MATCHED THEN INSERT (UserId, MustChangePassword, PasswordChangedDate, UpdatedDate)
        VALUES (@userId, 0, GETDATE(), GETDATE());
    `);
}

module.exports = { checkComplexity, assertComplexity, mustChangePassword, setNewPassword };
