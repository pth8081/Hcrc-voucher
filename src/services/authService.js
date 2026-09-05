const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../config/db');
const loginGuard = require('../utils/loginGuard');
const twoFactorService = require('./twoFactorService');
const userScheduleService = require('./userScheduleService');

async function login(username, password) {
  loginGuard.assertNotLocked(username);

  const user = await findUserByUsername(username);
  if (!user) {
    loginGuard.recordResult(username, false);
    throw unauthorized();
  }

  const role = roleOf(user);
  const passwordOk = await comparePassword(password, user.Password);
  if (!passwordOk) {
    loginGuard.recordResult(username, false, role);
    throw unauthorized();
  }

  loginGuard.recordResult(username, true, role);
  return buildLoginOutcome(user);
}

/** 'admin' dung nguong khoa dang nhap long hon vi da co lop 2FA bao ve rieng - xem loginGuard.js. */
function roleOf(user) {
  return Number(user.status) === 1 ? 'admin' : 'staff';
}

/**
 * Ket qua sau khi xac minh danh tinh chinh (mat khau hoac van tay/Face ID) THANH CONG - dung
 * chung cho ca 2 duong dang nhap. Tai khoan quan tri (status=1) BAT BUOC phai qua xac thuc
 * hai yeu to (TOTP) truoc khi duoc cap phien day du:
 *  - Chua tung thiet lap 2FA -> tra ve token TAM chi du quyen goi API thiet lap 2FA.
 *  - Da bat 2FA tu truoc -> tra ve token TAM chi du quyen goi API xac minh ma 2FA.
 *  - Khong phai quan tri (status=0) -> cap phien day du ngay, khong yeu cau 2FA.
 *
 * Truoc tien kiem tra tai khoan co dang trong thoi han su dung khong (UserAccountSchedule) -
 * ap dung cho MOI tai khoan, khong chi rieng admin. Kiem tra nay chay SAU KHI da xac minh
 * danh tinh dung (khong lo trang thai tai khoan cho nguoi chua biet mat khau/van tay), va
 * KHONG tinh vao bo dem loginGuard vi day khong phai loi go sai.
 */
async function buildLoginOutcome(user) {
  await userScheduleService.assertAccountActive(user.UserID);

  if (Number(user.status) === 1) {
    const status = await twoFactorService.getStatus(user.UserID);
    if (!status.enabled) {
      return { twoFactor: 'setup_required', pendingToken: issuePendingToken(user, '2fa_setup') };
    }
    return { twoFactor: 'verify_required', pendingToken: issuePendingToken(user, '2fa_verify') };
  }
  return { twoFactor: 'none', ...issueSession(user) };
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
      purpose: 'session',
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

/**
 * Token TAM, KHONG phai phien dang nhap day du - chi dung de goi 2 nhom API xac thuc hai
 * yeu to (thiet lap lan dau / xac minh ma). Het han rat nhanh (10 phut) va middleware xac
 * thuc chinh (middleware/auth.js) tu choi thang moi token co purpose khac 'session', nen token
 * nay khong the dung de goi bat ky API nghiep vu nao khac du bi lo.
 */
function issuePendingToken(user, purpose) {
  return jwt.sign(
    { purpose, userId: user.UserID, username: user.Username },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );
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

module.exports = { login, findUserByUsername, findUserById, issueSession, issuePendingToken, buildLoginOutcome, roleOf };
