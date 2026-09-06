// Tao/cap nhat 1 tai khoan QUAN TRI (status = 1) tren bang dbo.Users dang co san (dung chung
// voi cac he thong khac) - dung khi trien khai app tro thang vao DB that, chua co tai khoan
// quan tri nao de dang nhap lan dau.
//
// Cach dung:
//   node scripts/create-admin.js --username=admin_moi --password="MatKhauManh@123" \
//     --fullName="Nguyen Van Quan Tri" [--locationsGroup=GRP01] [--locationsDetail=LOC01]
//
// - Mat khau duoc hash bang bcrypt truoc khi luu (KHONG luu plaintext).
// - Neu Username da ton tai: cap nhat lai mat khau/ho ten va dat status = 1 (nang cap thanh
//   quan tri). Neu chua co: tao moi.
// - locationsGroup/locationsDetail la tuy chon - chi can neu muon tai khoan quan tri nay cung
//   duoc gan vao 1 dia diem cu the (thuong khong can, vi quan tri he thong mac dinh da xem/thao
//   tac duoc toan bo - xem README muc 13).
require('dotenv').config();
const bcrypt = require('bcryptjs');
const sql = require('mssql');
const { getDbConfig } = require('../src/config/env');

function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    const m = raw.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const { username, password, fullName } = args;
  const locationsGroup = args.locationsGroup || null;
  const locationsDetail = args.locationsDetail || null;

  if (!username || !password || !fullName) {
    console.error(
      'Thieu tham so bat buoc. Cach dung:\n' +
        '  node scripts/create-admin.js --username=... --password="..." --fullName="..." ' +
        '[--locationsGroup=...] [--locationsDetail=...]'
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Mat khau nen co it nhat 8 ky tu.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const pool = await sql.connect(getDbConfig());
  try {
    const existing = await pool
      .request()
      .input('username', sql.NVarChar(100), username)
      .query('SELECT UserID FROM dbo.Users WHERE Username = @username');

    if (existing.recordset.length) {
      await pool
        .request()
        .input('username', sql.NVarChar(100), username)
        .input('password', sql.NVarChar(200), passwordHash)
        .input('fullName', sql.NVarChar(200), fullName)
        .input('locationsGroup', sql.NVarChar(20), locationsGroup)
        .input('locationsDetail', sql.NVarChar(20), locationsDetail)
        .query(`
          UPDATE dbo.Users
          SET Password = @password, FullName = @fullName,
              Locations_Group = @locationsGroup, Locations_Detail = @locationsDetail,
              status = 1
          WHERE Username = @username
        `);
      console.log(`Da cap nhat tai khoan "${username}" thanh quan tri (status = 1).`);
    } else {
      await pool
        .request()
        .input('username', sql.NVarChar(100), username)
        .input('password', sql.NVarChar(200), passwordHash)
        .input('fullName', sql.NVarChar(200), fullName)
        .input('locationsGroup', sql.NVarChar(20), locationsGroup)
        .input('locationsDetail', sql.NVarChar(20), locationsDetail)
        .query(`
          INSERT INTO dbo.Users (Username, Password, FullName, Locations_Group, Locations_Detail, status)
          VALUES (@username, @password, @fullName, @locationsGroup, @locationsDetail, 1)
        `);
      console.log(`Da tao tai khoan quan tri moi "${username}".`);
    }
    console.log('Luu y: lan dang nhap dau tien tai khoan quan tri nay se bi bat buoc thiet lap 2FA (xem README muc 10).');
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('That bai:', err.message);
  process.exit(1);
});
