const bcrypt = require('bcryptjs');
const { sql, getPool } = require('../config/db');
const permissionService = require('./permissionService');

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.publicMessage = message;
  return err;
}

/**
 * Tao 1 tai khoan MOI tren dbo.Users - CHI ghi 6 cot app nay hieu (giong het cach
 * scripts/create-admin.js da lam tu truoc), de trong cac cot rieng cua he thong Core
 * (PositionCode_Name, DepartmentCode_Name, DSMART) vi app nay quan ly phan quyen doc lap,
 * khong phu thuoc cau truc/quy uoc cua he thong khac dung chung bang Users.
 */
async function createUser({ username, password, fullName, locationsGroup, locationsDetail, role }, createdBy) {
  const trimmedUsername = String(username || '').trim();
  if (!trimmedUsername) throw badRequest('Thieu ten dang nhap');
  if (!password || password.length < 8) throw badRequest('Mat khau phai co it nhat 8 ky tu');
  if (!fullName || !String(fullName).trim()) throw badRequest('Thieu ho ten');

  const pool = await getPool();
  const existing = await pool
    .request()
    .input('username', sql.NVarChar(100), trimmedUsername)
    .query('SELECT UserID FROM dbo.Users WHERE Username = @username');
  if (existing.recordset.length) {
    throw badRequest(`Ten dang nhap "${trimmedUsername}" da ton tai`);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const status = Number(role) === 1 ? 1 : 0;

  const result = await pool
    .request()
    .input('username', sql.NVarChar(100), trimmedUsername)
    .input('password', sql.NVarChar(200), passwordHash)
    .input('fullName', sql.NVarChar(200), String(fullName).trim())
    .input('locationsGroup', sql.NVarChar(20), locationsGroup || null)
    .input('locationsDetail', sql.NVarChar(20), locationsDetail || null)
    .input('status', sql.BigInt, status)
    .query(`
      INSERT INTO dbo.Users (Username, Password, FullName, Locations_Group, Locations_Detail, status)
      OUTPUT INSERTED.UserID
      VALUES (@username, @password, @fullName, @locationsGroup, @locationsDetail, @status)
    `);

  const userId = result.recordset[0].UserID;
  // Ghi ro quyen mac dinh ngay tu dau (thay vi de "chua co dong nao" ngam dinh) de admin thay
  // duoc ngay va sua neu can - chi co y nghia voi nhan vien, admin luon full quyen.
  if (status === 0) {
    await permissionService.createDefaultPermissions(userId, createdBy);
  }

  return { userId, username: trimmedUsername };
}

module.exports = { createUser };
