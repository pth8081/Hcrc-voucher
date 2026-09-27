const crypto = require('crypto');
const { sql, getPool } = require('../config/db');
const authService = require('./authService');

const KEY_BYTES = 32; // 256 bit - entropy cao, khong can hash cham (bcrypt) nhu mat khau nguoi go
const KEY_PREFIX = 'pak_'; // "partner api key" - de nhan biet chuoi nay la 1 API key khi thay trong log/code
const PREFIX_DISPLAY_LEN = 12; // vai ky tu dau hien trong danh sach admin de nhan dien, KHONG du de doan ra ca key

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.publicMessage = message;
  return err;
}

function generateRawKey() {
  return KEY_PREFIX + crypto.randomBytes(KEY_BYTES).toString('hex');
}

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Tao 1 API key moi cho 1 tai khoan NHAN VIEN co san (KHONG cho tai khoan quan tri - status=1
 * co nhieu dac quyen quan tri he thong ngoai pham vi thu hoi voucher, VA rieng admin con bi
 * bat buoc 2FA khi dang nhap qua UI; 1 API key voi entropy cao nhung KHONG co lop MFA thu 2 se
 * la 1 duong vong qua chinh sach 2FA bat buoc do neu duoc phep gan vao tai khoan quan tri).
 * Tra ve ca `apiKey` (chuoi that, CHI XUAT HIEN DUY NHAT LAN NAY - khong luu ban ro, khong the
 * lay lai sau) de admin sao chep gui cho doi tac ngay tren man hinh.
 */
async function create({ userId, label, canCheck, canRedeem, createdByUsername }) {
  if (!userId) throw badRequest('Thieu userId');
  if (!label || !String(label).trim()) throw badRequest('Thieu ten/nhan cho API key (Label)');
  const trimmedLabel = String(label).trim();
  if (trimmedLabel.length > 200) throw badRequest('Ten/nhan API key qua dai (toi da 200 ky tu)');

  const user = await authService.findUserById(Number(userId));
  if (!user) throw badRequest('Tai khoan da chon khong ton tai');
  if (Number(user.status) === 1) {
    throw badRequest('Khong the tao API key cho tai khoan quan tri - chi ap dung cho tai khoan nhan vien thu hoi.');
  }

  const finalCanCheck = canCheck !== false;
  const finalCanRedeem = canRedeem !== false;
  if (!finalCanCheck && !finalCanRedeem) {
    throw badRequest('API key phai co it nhat 1 quyen (kiem tra hoac thu hoi)');
  }

  const rawKey = generateRawKey();
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, PREFIX_DISPLAY_LEN);

  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, Number(userId))
    .input('label', sql.NVarChar(200), trimmedLabel)
    .input('keyPrefix', sql.NVarChar(20), keyPrefix)
    .input('keyHash', sql.NVarChar(64), keyHash)
    .input('canCheck', sql.Bit, finalCanCheck ? 1 : 0)
    .input('canRedeem', sql.Bit, finalCanRedeem ? 1 : 0)
    .input('createdBy', sql.NVarChar(100), createdByUsername)
    .query(`
      INSERT INTO dbo.PartnerApiKeys (UserId, Label, KeyPrefix, KeyHash, CanCheck, CanRedeem, CreatedByUsername)
      OUTPUT inserted.Id
      VALUES (@userId, @label, @keyPrefix, @keyHash, @canCheck, @canRedeem, @createdBy)
    `);

  return { id: result.recordset[0].Id, apiKey: rawKey, keyPrefix };
}

/** Danh sach toan bo key (con hieu luc lan da thu hoi) kem thong tin tai khoan gan voi - phuc
 * vu man hinh quan tri. KHONG bao gio tra ve KeyHash. */
async function list() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT k.Id, k.Label, k.KeyPrefix, k.CanCheck, k.CanRedeem, k.CreatedDate, k.CreatedByUsername,
           k.LastUsedDate, k.RevokedDate, k.RevokedByUsername,
           u.UserID AS userId, u.Username AS username, u.FullName AS fullName,
           u.Locations_Group AS locationsGroup, u.Locations_Detail AS locationsDetail
    FROM dbo.PartnerApiKeys k
    JOIN dbo.Users u ON u.UserID = k.UserId
    ORDER BY k.CreatedDate DESC
  `);
  return result.recordset;
}

/** Thu hoi 1 key (khong xoa - giu vet cho nhat ky quan tri/doi soat). Idempotent: thu hoi 1 key
 * da thu hoi tu truoc khong bao loi, chi khong doi RevokedDate/RevokedByUsername ban dau. */
async function revoke(id, revokedByUsername) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, Number(id))
    .input('revokedBy', sql.NVarChar(100), revokedByUsername)
    .query(`
      UPDATE dbo.PartnerApiKeys
      SET RevokedDate = GETDATE(), RevokedByUsername = @revokedBy
      WHERE Id = @id AND RevokedDate IS NULL
    `);
  if (result.rowsAffected[0] === 0) {
    // Phan biet "khong ton tai" voi "da thu hoi tu truoc" de admin khong hieu nham la loi he thong.
    const existing = await pool.request().input('id', sql.Int, Number(id)).query('SELECT Id FROM dbo.PartnerApiKeys WHERE Id = @id');
    if (!existing.recordset[0]) throw badRequest('Khong tim thay API key nay');
    // Da thu hoi tu truoc - coi la thanh cong (idempotent), khong bao loi.
  }
}

/** Tra ve ban ghi key CON HIEU LUC (chua thu hoi) theo hash - dung boi middleware xac thuc.
 * null neu khong khop hoac da bi thu hoi. */
async function findActiveByHash(keyHash) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('keyHash', sql.NVarChar(64), keyHash)
    .query(`
      SELECT Id, UserId, CanCheck, CanRedeem
      FROM dbo.PartnerApiKeys
      WHERE KeyHash = @keyHash AND RevokedDate IS NULL
    `);
  const row = result.recordset[0];
  if (!row) return null;
  return { id: row.Id, userId: row.UserId, canCheck: !!row.CanCheck, canRedeem: !!row.CanRedeem };
}

/** Cap nhat LastUsedDate - goi kieu "best-effort" (khong chan request chinh neu that bai). */
async function touchLastUsed(id) {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, Number(id)).query('UPDATE dbo.PartnerApiKeys SET LastUsedDate = GETDATE() WHERE Id = @id');
}

module.exports = { create, list, revoke, findActiveByHash, touchLastUsed, hashKey };
