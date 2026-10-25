const { sql, getPool } = require('../config/db');

/**
 * Buoc "1 tai khoan chi duoc 1 phien dang nhap dang hoat dong tai 1 thoi diem" (xem sql/036) -
 * dung CHUNG co che so nguyen tang dan voi PasswordVersion (passwordPolicyService.js), nhung
 * MUC DICH khac han: tang moi lan CAP PHIEN DAY DU thanh cong (khong phai moi lan doi mat khau).
 *
 * Luu trong CUNG bang dbo.UserPasswordPolicy (them cot rieng, khong tao bang moi) de tai su
 * dung dung 1 cach "doi chieu so nguyen thay vi dong ho" da chung minh an toan o day.
 */

/** Tang SessionVersion len 1 va tra ve gia tri MOI - goi DUY NHAT trong authService.js#issueSession,
 * ngay truoc khi ky JWT, de gia tri "nhung" vao token luon la gia tri MOI NHAT (lam token cua moi
 * phien dang nhap TRUOC DO tu dong "lac hau", bi tu choi o middleware/auth.js ngay lan goi API
 * tiep theo cua chung). */
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

module.exports = { bumpSessionVersion };
