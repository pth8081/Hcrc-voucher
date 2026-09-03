const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../config/db');

async function login(username, password) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('username', sql.NVarChar(100), username)
    .query(`
      SELECT UserID, Username, Password, FullName, Locations_Group, Locations_Detail, status
      FROM dbo.Users
      WHERE Username = @username
    `);

  const user = result.recordset[0];
  if (!user) {
    const err = new Error('Sai ten dang nhap hoac mat khau');
    err.statusCode = 401;
    err.publicMessage = err.message;
    throw err;
  }

  const passwordOk = await comparePassword(password, user.Password);
  if (!passwordOk) {
    const err = new Error('Sai ten dang nhap hoac mat khau');
    err.statusCode = 401;
    err.publicMessage = err.message;
    throw err;
  }

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

async function comparePassword(plain, stored) {
  if (!stored) return false;
  // Ho tro ca mat khau da hash bcrypt lan mat khau plaintext cu (di chuyen dan)
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored;
}

module.exports = { login };
