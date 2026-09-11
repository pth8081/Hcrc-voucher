const { sql, getPool } = require('../config/db');
const userScheduleService = require('../services/userScheduleService');

/**
 * H1: JWT chi "chup" role/trang thai tai khoan LUC DANG NHAP (xem authService.issueSession) -
 * neu 1 admin bi khoa/xoa/het han sau do, token cu cua ho van con hop le den khi het han (mac
 * dinh 8h, JWT_EXPIRES_IN) vi middleware xac thuc truoc day CHI kiem tra chu ky JWT, khong doi
 * chieu lai voi CSDL. Module nay kiem tra lai trang thai MOI NHAT (status/IsDeleted/lich hieu
 * luc) tu CSDL, nhung dung 1 cache TTL ngan (khong phai 1 DB round-trip moi request) de khong
 * lam cham moi API. Ket qua: 1 tai khoan bi khoa/xoa co hieu luc gan nhu ngay lap tuc (trong
 * vong TTL_MS, hoac NGAY LAP TUC neu goi invalidate() luc khoa/xoa - xem userScheduleService
 * caller trong user.controller.js) thay vi phai cho den khi token het han.
 */
const TTL_MS = 30 * 1000;
const cache = new Map(); // userId -> { exists, role, isDeleted, activeState, passwordChangedAt, expiresAt }

async function getFreshUserState(userId) {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT u.status AS role, s.ActiveFrom, s.ActiveUntil, ISNULL(s.IsDeleted, 0) AS isDeleted,
             p.PasswordChangedDate AS passwordChangedDate
      FROM dbo.Users u
      LEFT JOIN dbo.UserAccountSchedule s ON s.UserId = u.UserID
      LEFT JOIN dbo.UserPasswordPolicy p ON p.UserId = u.UserID
      WHERE u.UserID = @userId
    `);
  const row = result.recordset[0];
  const state = row
    ? {
        exists: true,
        role: row.role,
        isDeleted: !!row.isDeleted,
        activeState: userScheduleService.evaluate({ ActiveFrom: row.ActiveFrom, ActiveUntil: row.ActiveUntil }).state,
        // Dot ra soat sau phat hien: doi chieu voi "iat" (thoi diem cap) cua JWT o
        // middleware/auth.js - token cap TRUOC lan doi mat khau gan nhat se bi tu choi, dong khe
        // ho "token cu van dung duoc binh thuong du mat khau da bi doi de khoa ke gia mao".
        passwordChangedAt: row.passwordChangedDate ? new Date(row.passwordChangedDate).getTime() : null,
      }
    : { exists: false };

  const entry = { ...state, expiresAt: Date.now() + TTL_MS };
  cache.set(userId, entry);
  return entry;
}

/** Goi khi admin khoa/xoa/mo/khoi phuc 1 tai khoan de thay doi co hieu luc NGAY, khong can
 * cho het TTL_MS. */
function invalidate(userId) {
  cache.delete(Number(userId));
}

module.exports = { getFreshUserState, invalidate };
