const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../config/db');
const loginGuard = require('../utils/loginGuard');
const twoFactorService = require('./twoFactorService');
const userScheduleService = require('./userScheduleService');
const passwordPolicyService = require('./passwordPolicyService');
const permissionService = require('./permissionService');

/**
 * Doc JWT_EXPIRES_IN tu .env an toan - TRANH 1 "bay" thuong gap cua jsonwebtoken: bien .env
 * LUON la CHUOI (vd "3600"), va khi truyen 1 chuoi THUAN SO cho tuy chon `expiresIn`, thu vien
 * hieu do la MILI-GIAY (dung goi "ms") chu KHONG PHAI giay nhu da tuong - "3600" bi hieu thanh
 * 3.6 GIAY thay vi 1 gio, khien token het han ngay lap tuc, moi tai khoan dang nhap xong thao
 * tac gi cung bi dang xuat. O day: neu gia tri chi toan chu so, tu ep sang KIEU SO (luc do
 * jsonwebtoken hieu dung la GIAY) - neu co don vi ro rang (vd "8h", "30m") thi giu nguyen chuoi.
 */
function resolveJwtExpiresIn() {
  const raw = process.env.JWT_EXPIRES_IN;
  if (!raw) return '8h';
  const trimmed = String(raw).trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

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

  // Tai khoan cu (tao ngoai app nay, truoc khi co bcrypt) co the con mat khau dang plaintext -
  // vua xac minh dung xong, nang cap ngay thanh bcrypt de tu lan sau khong con luu tho nua.
  // Khong lam gian doan dang nhap: loi nang cap (neu co) chi ghi log, khong throw.
  if (!isBcryptHash(user.Password)) {
    await rehashPlaintextPassword(user.UserID, password).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Nang cap mat khau plaintext len bcrypt that bai:', err.message);
    });
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
 * chung cho ca 2 duong dang nhap. Thu tu cac buoc bat buoc truoc khi duoc cap phien day du:
 *  1. Doi mat khau (passwordPolicyService.js) - ap dung cho MOI tai khoan, ca quan tri lan
 *     nhan vien, trong LAN DANG NHAP DAU TIEN vao app nay (hoac sau khi bi dat lai mat khau).
 *  2. Xac thuc hai yeu to TOTP (twoFactorService.js) - CHI bat buoc voi tai khoan quan tri
 *     (status=1):
 *      - Chua tung thiet lap 2FA -> tra ve token TAM chi du quyen goi API thiet lap 2FA.
 *      - Da bat 2FA tu truoc -> tra ve token TAM chi du quyen goi API xac minh ma 2FA.
 *  3. Khong con buoc nao khac -> cap phien day du.
 *
 * Truoc tien kiem tra tai khoan co dang trong thoi han su dung khong (UserAccountSchedule) -
 * ap dung cho MOI tai khoan, khong chi rieng admin. Kiem tra nay chay SAU KHI da xac minh
 * danh tinh dung (khong lo trang thai tai khoan cho nguoi chua biet mat khau/van tay), va
 * KHONG tinh vao bo dem loginGuard vi day khong phai loi go sai.
 */
async function buildLoginOutcome(user) {
  await userScheduleService.assertAccountActive(user.UserID);

  const mustChangePassword = await passwordPolicyService.mustChangePassword(user.UserID);
  if (mustChangePassword) {
    return { passwordChange: 'required', pendingToken: issuePendingToken(user, 'password_change') };
  }

  if (Number(user.status) === 1) {
    const status = await twoFactorService.getStatus(user.UserID);
    if (!status.enabled) {
      return { twoFactor: 'setup_required', pendingToken: issuePendingToken(user, '2fa_setup') };
    }
    return { twoFactor: 'verify_required', pendingToken: issuePendingToken(user, '2fa_verify') };
  }
  return { twoFactor: 'none', ...(await issueSession(user)) };
}

/** Doi mat khau bat buoc (token TAM purpose='password_change') roi tiep tuc luong dang nhap
 * (2FA neu la quan tri, hoac cap phien day du luon). */
async function changePasswordForced(userId, newPassword) {
  await passwordPolicyService.setNewPassword(userId, newPassword);
  const user = await findUserById(userId);
  return buildLoginOutcome(user);
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

/**
 * Dung chung cho ca dang nhap mat khau lan dang nhap WebAuthn (van tay/Face ID) - cung 1 phien
 * JWT. Nhung ca quyen tinh nang (permissionService.js) vao thang trong object `user` tra ve de
 * frontend an/hien menu ma khong can goi them API - giong het cach role/locationsGroup da lam
 * tu truoc. Quyen chi "chup" tai thoi diem dang nhap, admin doi quyen cho nguoi dang co phien
 * se can dang nhap lai moi thay hieu luc - chap nhan duoc, nhat quan voi cach role/lich hieu
 * luc tai khoan da hoat dong (xem userScheduleService.js).
 */
async function issueSession(user) {
  const role = Number(user.status) === 1 ? 'admin' : 'staff';
  const permissions = await permissionService.resolvePermissions({ userId: user.UserID, role: user.status });

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
    { expiresIn: resolveJwtExpiresIn() }
  );

  return {
    token,
    user: {
      userId: user.UserID,
      username: user.Username,
      fullName: user.FullName,
      locationsGroup: user.Locations_Group,
      locationsDetail: user.Locations_Detail,
      role,
      permissions,
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

function isBcryptHash(stored) {
  return !!stored && (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$'));
}

async function comparePassword(plain, stored) {
  if (!stored) return false;
  // Ho tro ca mat khau da hash bcrypt lan mat khau plaintext cu (di chuyen dan)
  if (isBcryptHash(stored)) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored;
}

/** Nang cap 1 tai khoan con mat khau plaintext (tao ngoai app, truoc khi co bcrypt) len bcrypt
 * ngay sau lan dang nhap dung dau tien - giam thoi gian ton tai mat khau dang tho trong DB. */
async function rehashPlaintextPassword(userId, plain) {
  const passwordHash = await bcrypt.hash(plain, 10);
  const pool = await getPool();
  await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('password', sql.NVarChar(200), passwordHash)
    .query('UPDATE dbo.Users SET Password = @password WHERE UserID = @userId');
}

module.exports = {
  login,
  findUserByUsername,
  findUserById,
  issueSession,
  issuePendingToken,
  buildLoginOutcome,
  changePasswordForced,
  roleOf,
  comparePassword,
};
