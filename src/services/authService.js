const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../config/db');
const loginGuard = require('../utils/loginGuard');
const twoFactorService = require('./twoFactorService');
const userScheduleService = require('./userScheduleService');
const passwordPolicyService = require('./passwordPolicyService');
const permissionService = require('./permissionService');
const sessionVersionService = require('./sessionVersionService');
const sessionRevalidation = require('../utils/sessionRevalidation');

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

// H4: bcrypt.compare co chu dich cham (~50-100ms tuy cost factor) - neu username KHONG TON
// TAI thi login() truoc day tra loi NGAY (bo qua hoan toan bcrypt), con username CO TON TAI
// thi luon mat them ngan do bcrypt.compare that su chay, du mat khau dung hay sai. Ke tan cong
// do THOI GIAN PHAN HOI co the suy ra 1 ten dang nhap co ton tai hay khong (du thong bao loi
// tra ve GIONG HET NHAU), phuc vu do quet danh sach tai khoan that truoc khi tan cong mat khau.
// Hash "gia" nay khong dung de xac thuc bat ky ai - chi de ton thoi gian TUONG DUONG 1 lan
// bcrypt.compare that khi username khong ton tai, xoa bo chenh lech thoi gian giua 2 nhanh.
const DUMMY_HASH_FOR_TIMING = bcrypt.hashSync('khong-dung-de-xac-thuc-chi-de-can-bang-thoi-gian', 10);

async function login(username, password) {
  loginGuard.assertNotLocked(username);

  const user = await findUserByUsername(username);
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH_FOR_TIMING);
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
 * 2FA bat buoc voi tai khoan quan tri DAY DU (status/role=1) VA tai khoan "Quan tri doi tac"
 * (muc 4j, permissions.isPartnerAdmin - vd tai khoan cap rieng cho Fuji tu quan ly nhan vien cua
 * ho) - ca 2 deu co quyen tao/khoa tai khoan nguoi khac nen rui ro cao hon nhan vien thuong neu bi
 * lo mat khau. Dung CHUNG 1 ham nay o ca buildLoginOutcome() (luc dang nhap, duoi day) LAN
 * middleware/require2FAManagement.js (2 API quan ly 2FA cua CHINH tai khoan dang dang nhap o
 * trang "Bao mat") - 1 nguon su that duy nhat, tranh 2 noi tinh dieu kien lech nhau.
 */
async function requiresMandatory2FA(role, userId) {
  if (Number(role) === 1) return true;
  const permissions = await permissionService.getPermissions(userId);
  return permissions.isPartnerAdmin;
}

/**
 * Ket qua sau khi xac minh danh tinh chinh (mat khau hoac van tay/Face ID) THANH CONG - dung
 * chung cho ca 2 duong dang nhap. Thu tu cac buoc bat buoc truoc khi duoc cap phien day du:
 *  1. Doi mat khau (passwordPolicyService.js) - ap dung cho MOI tai khoan, ca quan tri lan
 *     nhan vien, trong LAN DANG NHAP DAU TIEN vao app nay (hoac sau khi bi dat lai mat khau).
 *  2. Xac thuc hai yeu to TOTP (twoFactorService.js) - CHI bat buoc voi tai khoan can
 *     `requiresMandatory2FA()` (quan tri day du HOAC "Quan tri doi tac", xem o tren) VA chi khi
 *     dang nhap bang mat khau (skipTwoFactor=false):
 *      - Chua tung thiet lap 2FA -> tra ve token TAM chi du quyen goi API thiet lap 2FA.
 *      - Da bat 2FA tu truoc -> tra ve token TAM chi du quyen goi API xac minh ma 2FA.
 *  3. Khong con buoc nao khac -> cap phien day du.
 *
 * Truoc tien kiem tra tai khoan co dang trong thoi han su dung khong (UserAccountSchedule) -
 * ap dung cho MOI tai khoan, khong chi rieng admin. Kiem tra nay chay SAU KHI da xac minh
 * danh tinh dung (khong lo trang thai tai khoan cho nguoi chua biet mat khau/van tay), va
 * KHONG tinh vao bo dem loginGuard vi day khong phai loi go sai.
 *
 * skipTwoFactor: theo yeu cau nguoi dung, dang nhap bang van tay/Face ID BO QUA buoc nhap ma
 * TOTP (webauthnService.js truyen true) - mat khau van bat buoc 2FA nhu cu. An toan vi dang ky
 * passkey tren 1 thiet bi da bat buoc di qua DU ca doi mat khau LAN thiet lap 2FA it nhat 1 lan
 * truoc do (xem webauthnService.js#getRegistrationOptions - can phien day du moi dang ky duoc),
 * nen 1 admin co passkey chac chan da tung xac thuc 2 yeu to; vân tay/Face ID tu no da la 1 yeu
 * to manh (gan voi thiet bi + sinh trac hoc), duoc nhieu he thong coi la du thay the TOTP lap lai
 * moi lan dang nhap.
 */
async function buildLoginOutcome(user, { skipTwoFactor = false } = {}) {
  await userScheduleService.assertAccountActive(user.UserID);

  const mustChangePassword = await passwordPolicyService.mustChangePassword(user.UserID);
  if (mustChangePassword) {
    return { passwordChange: 'required', pendingToken: issuePendingToken(user, 'password_change') };
  }

  if ((await requiresMandatory2FA(user.status, user.UserID)) && !skipTwoFactor) {
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
 *
 * confirmTakeover: theo yeu cau nguoi dung - TRUOC KHI cap phien moi, neu tai khoan nay co lan
 * dang nhap gan day CHUA duoc dang xuat ro rang (sessionVersionService.js#hasRecentSession),
 * CHAN LAI va nem loi sessionConflict() (mang theo 1 confirmToken TAM, xem issuePendingToken)
 * thay vi cap phien ngay - CHI khi goi lai VOI confirmTakeover=true (tu confirmSessionTakeover()
 * ben duoi, sau khi nguoi dung dong y o hop thoai) moi thuc su cap phien. Dat o DAY (diem chung
 * CUOI CUNG truoc khi cap phien that, sau ca mat khau/van tay LAN 2FA) de CHI 1 noi can xu ly,
 * ap dung dong deu cho ca 3 duong dang nhap (mat khau, van tay, sau khi xac minh 2FA) ma khong
 * can sua rieng tung noi goi buildLoginOutcome()/issueSession().
 */
async function issueSession(user, { confirmTakeover = false } = {}) {
  if (!confirmTakeover && (await sessionVersionService.hasRecentSession(user.UserID))) {
    throw sessionConflict(user);
  }

  const role = Number(user.status) === 1 ? 'admin' : 'staff';
  const permissions = await permissionService.resolvePermissions({ userId: user.UserID, role: user.status });
  // Nhung san phien ban mat khau HIEN TAI vao token - middleware/auth.js doi chieu lai sau nay
  // de phat hien mat khau da doi KE TU LUC token nay duoc cap, khong con phu thuoc dong ho may
  // chu nao (xem passwordPolicyService.js#getPasswordVersion va sql/025_add_password_version.sql).
  const passwordVersion = await passwordPolicyService.getPasswordVersion(user.UserID);
  // M17: "1 tai khoan = 1 phien dang nhap dang hoat dong" (xem sql/036) - TANG bo dem truoc,
  // nhung GIA TRI MOI vao token: moi lan ham nay chay (= moi lan 1 luot dang nhap/xac minh 2FA
  // di toi dich, bat ke tu mat khau hay van tay) se tu dong lam MOI token CAP TRUOC DO cho CHINH
  // tai khoan nay mat hieu luc (middleware/auth.js so sanh lai voi gia tri nay). Xoa cache NGAY
  // (khong doi TTL 30s cua sessionRevalidation.js het han) de phien cu bi tu choi cang som cang
  // tot, cung nguyen tac voi passwordPolicyService.js#setNewPassword/adminResetPassword.
  const sessionVersion = await sessionVersionService.bumpSessionVersion(user.UserID);
  await sessionVersionService.recordLogin(user.UserID);
  sessionRevalidation.invalidate(user.UserID);

  const token = jwt.sign(
    {
      purpose: 'session',
      userId: user.UserID,
      username: user.Username,
      fullName: user.FullName,
      locationsGroup: user.Locations_Group,
      locationsDetail: user.Locations_Detail,
      role: user.status,
      passwordVersion,
      sessionVersion,
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

/** 409 Conflict + `code: 'SESSION_CONFLICT'` rieng (khac cac loi 401/400 khac) de frontend
 * phan biet duoc day la hoi-xac-nhan, khong phai loi that su - hien hop thoai Huy/OK thay vi
 * toast loi thong thuong (xem login.js/twofa.js/webauthn.js). Mang theo `confirmToken` (token
 * TAM purpose='session_takeover', 2 phut) - bam OK se goi POST /auth/confirm-takeover voi
 * token nay (xem confirmSessionTakeover() duoi day) de hoan tat dang nhap, KHONG can nhap lai
 * mat khau/captcha/ma 2FA/vân tay (nhung thu nay deu CHI dung 1 LAN - captcha/ma 2FA da bi
 * "dung" ngay o lan goi dau tien phat hien xung dot, goi lai se that bai; confirmToken rieng
 * nay chinh la bang chung "da xac thuc danh tinh thanh cong truoc do", khong can lam lai). */
function sessionConflict(user) {
  const err = new Error('Tai khoan nay co the dang dang nhap o noi khac (thiet bi/tab khac). Tiep tuc dang nhap o day se DANG XUAT phien do ngay.');
  err.statusCode = 409;
  err.code = 'SESSION_CONFLICT';
  err.publicMessage = err.message;
  err.confirmToken = issuePendingToken(user, 'session_takeover');
  return err;
}

/** Hoan tat dang nhap sau khi nguoi dung dong y "ghi de" phien cu (bam OK o hop thoai
 * SESSION_CONFLICT) - xem sessionConflict() o tren. confirmToken da duoc xac thuc purpose boi
 * middleware (require2FAPending(['session_takeover'])) truoc khi toi duoc day. */
async function confirmSessionTakeover(userId) {
  const user = await findUserById(userId);
  if (!user) {
    throw unauthorized();
  }
  return issueSession(user, { confirmTakeover: true });
}

/** Dang xuat THAT (goi tu API moi /auth/logout) - khac voi truoc day nut "Dang xuat" CHI xoa
 * token o trinh duyet (token van con hieu luc tren server den khi tu het han, toi da 8 tieng -
 * 1 ke chiem duoc token bi lo van dung duoc du chu tai khoan da bam dang xuat). Vo hieu hoa
 * NGAY phien hien tai (bump SessionVersion - giong het co che "phien moi day phien cu" cua
 * issueSession(), chi khac la khong co phien MOI nao thay the) VA xoa LastLoginDate ve NULL
 * (sessionVersionService.js#hasRecentSession) de lan dang nhap tiep theo KHONG bi hoi "co the
 * dang dang nhap o noi khac" gia - nguoi dung vua chu dong dang xuat that su. */
async function logout(userId) {
  await sessionVersionService.bumpSessionVersion(userId);
  await sessionVersionService.clearLastLoginDate(userId);
  sessionRevalidation.invalidate(userId);
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
  requiresMandatory2FA,
  logout,
  confirmSessionTakeover,
};
