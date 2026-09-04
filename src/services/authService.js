const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../config/db');
const loginGuard = require('../utils/loginGuard');

async function login(username, password) {
  loginGuard.assertNotLocked(username);

  const user = await findUserByUsername(username);
  if (!user) {
    loginGuard.recordResult(username, false);
    throw unauthorized();
  }

  const passwordOk = await comparePassword(password, user.Password);
  if (!passwordOk) {
    loginGuard.recordResult(username, false);
    throw unauthorized();
  }

  loginGuard.recordResult(username, true);
  return issueSession(user);
}

async function findUserByUsername(username) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('username', sql.NVarChar(100), username)
    .query(`
      SELECT UserID, Username, Password, FullName, Locations_Group, Locations_Detail, status
      FROM dbo.Users
      WHERE Username = @username
    `);
  return result.recordset[0] || null;
}

async function findUserById(userId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT UserID, Username, FullName, Locations_Group, Locations_Detail, status
      FROM dbo.Users
      WHERE UserID = @userId
    `);
  return result.recordset[0] || null;
}

/** Dung chung cho ca dang nhap mat khau lan dang nhap WebAuthn (van tay/Face ID) - cung 1 phien JWT. */
function issueSession(user) {
  const token = jwt.sign(
    {
      userId: user.UserID,
      username: user.Username,
      fullName: user.FullName,
      locationsGroup: user.Locations_Group,
      locationsDetail: user.Locations_Detail,
      role: user.status,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  return {
    token,
    user: {
      userId: user.UserID,
      username: user.Username,
      fullName: user.FullName,
      locationsGroup: user.Locations_Group,
      locationsDetail: user.Locations_Detail,
    },
  };
}

function unauthorized() {
  const err = new Error('Sai ten dang nhap hoac mat khau');
  err.statusCode = 401;
  err.publicMessage = err.message;
  return err;
}

async function comparePassword(plain, stored) {
  if (!stored) return false;
  // Ho tro ca mat khau da hash bcrypt lan mat khau plaintext cu (di chuyen dan)
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored;
}

module.exports = { login, findUserByUsername, findUserById, issueSession };
