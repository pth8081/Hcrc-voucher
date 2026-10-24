const fs = require('fs');
const path = require('path');
const { getPool } = require('../config/db');

/**
 * Doi khang sau phat hien (bao cao thuc te - xem README muc 3h): "git pull" code moi nhung QUEN
 * chay `npm run migrate` truoc khi restart la 1 loi trien khai DE MAC PHAI va HAU QUA RAT NANG -
 * nhieu doan code (vd permissionService.js#getPermissions(), goi tu requireFeature.js o MOI lan
 * quet/thu hoi cua MOI tai khoan nhan vien) truy van VO DIEU KIEN cac cot duoc them boi migration
 * MOI NHAT, du tai khoan do co lien quan toi tinh nang moi hay khong. Thieu 1 cot la **CA UNG
 * DUNG NGUNG QUET/THU HOI DUOC CHO MOI NGUOI** - du requireFeature.js (v3.59) da gan thong bao
 * loi ro rang hon, do van la 1 su co san xuat that su neu khong ai de y kip thoi.
 *
 * Kiem tra NGAY LUC KHOI DONG (goi tu server.js, TRUOC khi mo cong HTTP nhan request that): doi
 * chieu danh sach file `sql/*.sql` dong goi CUNG code dang chay voi danh sach da duoc ghi nhan
 * "da ap dung" trong `dbo.SchemaMigrations` (bang do chinh `scripts/migrate.js` ghi vao sau moi
 * lan chay thanh cong - xem sql/032). Con thieu file nao -> DUNG tien trinh NGAY (khong mo cong
 * HTTP), liet ke dung ten file con thieu - giong cach `config/env.js#assertSecretsStrong()` da
 * lam voi JWT_SECRET/ENCRYPTION_KEY yeu, thay vi de app "chay binh thuong" voi 1 diem hong am
 * tham chi lo ra khi co nguoi dung that gap loi.
 *
 * An toan voi lan deploy DAU TIEN sau khi co kiem tra nay (chua tung chay migrate, `SchemaMigrations`
 * cung chua ton tai): loi "khong doc duoc bang" duoc coi nhu "chua ap dung file nao", roi xuong
 * dung 1 nhanh bao loi ben duoi (thong bao van dung huong xu ly: chay `npm run migrate`).
 */
async function assertSchemaUpToDate() {
  const sqlDir = path.join(__dirname, '..', '..', 'sql');
  const expectedFiles = fs.readdirSync(sqlDir).filter((f) => f.endsWith('.sql')).sort();

  const pool = await getPool();
  let appliedFiles;
  try {
    const result = await pool.request().query('SELECT Filename FROM dbo.SchemaMigrations');
    appliedFiles = new Set(result.recordset.map((r) => r.Filename));
  } catch (err) {
    appliedFiles = new Set();
  }

  const missing = expectedFiles.filter((f) => !appliedFiles.has(f));
  if (missing.length) {
    throw new Error(
      `CSDL dang THIEU ${missing.length} migration can thiet cho phien ban code dang chay: ` +
      `${missing.join(', ')}. Chay "npm run migrate" TRUOC KHI khoi dong lai - thieu migration ` +
      `co the lam GIAN DOAN HOAN TOAN chuc nang quet/thu hoi voucher cho MOI tai khoan nhan vien ` +
      `(xem README muc 3h).`
    );
  }
}

module.exports = { assertSchemaUpToDate };
