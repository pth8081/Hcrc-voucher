const { sql, getPool } = require('../config/db');

/**
 * Buoc "1 tai khoan chi duoc 1 phien dang nhap dang hoat dong tai 1 thoi diem" (xem sql/036) -
 * dung CHUNG co che so nguyen tang dan voi PasswordVersion (passwordPolicyService.js), nhung
 * MUC DICH khac han: tang moi lan CAP PHIEN DAY DU thanh cong (khong phai moi lan doi mat khau).
 *
 * Luu trong CUNG bang dbo.UserPasswordPolicy (them cot rieng, khong tao bang moi) de tai su
 * dung dung 1 cach "doi chieu so nguyen thay vi dong ho" da chung minh an toan o day.
 */

/** Tang SessionVersion len 1 va tra ve gia tri MOI - goi trong authService.js#issueSession,
 * ngay truoc khi ky JWT, de gia tri "nhung" vao token luon la gia tri MOI NHAT (lam token cua moi
 * phien dang nhap TRUOC DO tu dong "lac hau", bi tu choi o middleware/auth.js ngay lan goi API
 * tiep theo cua chung). Cung duoc authService.js#logout goi de vo hieu hoa phien HIEN TAI ngay
 * lap tuc khi nguoi dung chu dong dang xuat (xem logout() ben duoi - truoc day nut "Dang xuat"
 * CHI xoa token o trinh duyet, khong bao server, token van con hieu luc den khi het han tu nhien). */
async function bumpSessionVersion(userId) {
  const pool = await getPool();
  // Nhanh "WHEN NOT MATCHED" thuc te KHONG BAO GIO chay trong luong dang nhap binh thuong (da
  // qua buoc kiem tra mustChangePassword() - CHI tra ve false khi dong UserPasswordPolicy DA
  // TON TAI - truoc khi toi duoc day), chi la lop phong ho cho cac duong goi khac trong tuong
  // lai: de cac cot con lai dung DUNG GIA TRI MAC DINH cua bang (xem sql/012/025), tranh ghi de
  // sai lech voi gia tri "that" ma 1 duong goi khac co the da thiet lap.
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .query(`
      MERGE dbo.UserPasswordPolicy AS target
      USING (SELECT @userId AS UserId) AS src
      ON target.UserId = src.UserId
      WHEN MATCHED THEN UPDATE SET SessionVersion = SessionVersion + 1
      WHEN NOT MATCHED THEN INSERT (UserId, SessionVersion) VALUES (@userId, 2)
      OUTPUT inserted.SessionVersion;
    `);
  return result.recordset[0].SessionVersion;
}

// Khoang thoi gian (gio) ke tu lan dang nhap gan nhat van con duoc coi la "co the dang hoat
// dong o noi khac" - dung CHUNG gia tri voi thoi han phien JWT mac dinh (authService.js#resolveJwtExpiresIn,
// 8 tieng) de hop ly: qua khoang nay, token cu (neu con) cung da tu het han, khong con gi de
// "chiem cho" nua. Hang so rieng (khong doc .env) de giu sessionVersionService doc lap voi
// authService - lech 1 chut neu JWT_EXPIRES_IN bi doi khong gay hau qua nghiem trong (chi la
// suy doan UX, khong phai kiem tra bao mat - phien cu van bi vo hieu hoa NGAY khi co phien moi
// du co hien canh bao hay khong, xem bumpSessionVersion() o tren).
const SESSION_CONFLICT_WINDOW_HOURS = 8;

/** Danh dau 1 lan dang nhap THANH CONG (LastLoginDate = bay gio) - goi NGAY SAU bumpSessionVersion
 * trong authService.js#issueSession. Tach rieng khoi bumpSessionVersion() vi 2 muc dich khac
 * nhau: logout() cung goi bumpSessionVersion nhung KHONG duoc ghi "vua dang nhap". */
async function recordLogin(userId) {
  const pool = await getPool();
  await pool
    .request()
    .input('userId', sql.Int, userId)
    .query(`
      MERGE dbo.UserPasswordPolicy AS target
      USING (SELECT @userId AS UserId) AS src
      ON target.UserId = src.UserId
      WHEN MATCHED THEN UPDATE SET LastLoginDate = GETDATE()
      WHEN NOT MATCHED THEN INSERT (UserId, LastLoginDate) VALUES (@userId, GETDATE());
    `);
}

/** Xoa LastLoginDate ve NULL khi dang xuat RO RANG - de lan dang nhap tiep theo (tu thiet bi
 * khac, hoac chinh thiet bi nay) KHONG bi bao "co the dang dang nhap o noi khac" gia, vi nguoi
 * dung da chu dong dang xuat sach se. Goi cung luc voi bumpSessionVersion() trong logout(). */
async function clearLastLoginDate(userId) {
  const pool = await getPool();
  await pool
    .request()
    .input('userId', sql.Int, userId)
    .query('UPDATE dbo.UserPasswordPolicy SET LastLoginDate = NULL WHERE UserId = @userId');
}

/** true = tai khoan nay co lan dang nhap gan day (trong SESSION_CONFLICT_WINDOW_HOURS gio) CHUA
 * duoc dang xuat ro rang - dung o authService.js#issueSession de quyet dinh co can hoi xac nhan
 * "co the dang dang nhap o noi khac" truoc khi cap phien moi hay khong. Day la suy doan UX (app
 * nay khong theo doi "dang mo tab that su" theo thoi gian thuc), khong phai kiem tra bao mat. */
async function hasRecentSession(userId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .query('SELECT LastLoginDate FROM dbo.UserPasswordPolicy WHERE UserId = @userId');
  const lastLoginDate = result.recordset[0] && result.recordset[0].LastLoginDate;
  if (!lastLoginDate) return false;
  const hoursSince = (Date.now() - new Date(lastLoginDate).getTime()) / (1000 * 60 * 60);
  return hoursSince < SESSION_CONFLICT_WINDOW_HOURS;
}

module.exports = { bumpSessionVersion, recordLogin, clearLastLoginDate, hasRecentSession };
