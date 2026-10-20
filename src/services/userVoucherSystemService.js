const { sql, getPool } = require('../config/db');

/**
 * Phan quyen THEO HE THONG VOUCHER (ApiConnections, vd "BRGmart"/"Fuji") - tach biet hoan toan
 * voi quyen tinh nang (permissionService.js) va nhom quyen xem bao cao theo cong ty
 * (reportAccessService.js). Dung chung cho CA 2 muc dich:
 *  1. Gioi han he thong duoc phep CHON khi quet/thu hoi voucher (man hinh Quet voucher).
 *  2. Gioi han he thong duoc phep XEM trong 3 bao cao (doi soat/tong hop/voucher da su dung) -
 *     vd cap 1 tai khoan doi soat rieng cho doi tac Fuji, chi thay DUNG du lieu cua Fuji.
 *
 * Quy uoc: khong co dong nao trong UserVoucherSystems = KHONG GIOI HAN (duoc dung/xem TOAN BO
 * he thong hien co). Co it nhat 1 dong = CHI duoc dung/xem DUNG cac he thong do.
 */

/** null = khong gioi han (tat ca he thong). Mang (co the rong) = CHI duoc dung dung cac id nay. */
async function getAllowedConnectionIds(userId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .query('SELECT ConnectionId FROM dbo.UserVoucherSystems WHERE UserId = @userId');
  if (!result.recordset.length) return null;
  return result.recordset.map((r) => r.ConnectionId);
}

/**
 * He thong voucher duoc phep dung CHUNG cho toan bo tai khoan dang gan dung 1 diem thu hoi
 * (Users.Locations_Detail = locationCode, bo qua tai khoan da bi xoa mem) - dung de loc o chon
 * "He thong voucher" tren 3 man hinh bao cao khi admin da chon 1 "Diem thu hoi" cu the (xem
 * report.controller.js#filterSystems). Cung quy uoc null/[]/[...] nhu getAllowedConnectionIds:
 * null = khong gioi han (co it nhat 1 tai khoan tai diem nay duoc dung TOAN BO he thong, nen
 * xem nhu ca diem khong gioi han), [] = diem nay khong co tai khoan nao (hoac tat ca tai khoan
 * deu bi khoa het, thuc te khong xay ra vi 1 tai khoan it nhat phai co 1 he thong duoc dung),
 * [...] = hop cac he thong ma IT NHAT 1 tai khoan tai diem nay duoc dung.
 */
async function getAllowedConnectionIdsForLocation(locationCode) {
  const pool = await getPool();
  const usersResult = await pool
    .request()
    .input('code', sql.NVarChar(100), locationCode)
    .query(`
      SELECT u.UserID
      FROM dbo.Users u
      LEFT JOIN dbo.UserAccountSchedule s ON s.UserId = u.UserID
      WHERE LTRIM(RTRIM(u.Locations_Detail)) = @code AND ISNULL(s.IsDeleted, 0) = 0
    `);
  const userIds = usersResult.recordset.map((r) => r.UserID);
  if (!userIds.length) return [];

  const request = pool.request();
  const placeholders = userIds.map((id, i) => {
    request.input(`u${i}`, sql.Int, id);
    return `@u${i}`;
  });
  const restrictionResult = await request.query(
    `SELECT UserId, ConnectionId FROM dbo.UserVoucherSystems WHERE UserId IN (${placeholders.join(', ')})`
  );
  const restrictedUserIds = new Set(restrictionResult.recordset.map((r) => r.UserId));
  const hasUnrestrictedUser = userIds.some((id) => !restrictedUserIds.has(id));
  if (hasUnrestrictedUser) return null;
  return [...new Set(restrictionResult.recordset.map((r) => r.ConnectionId))];
}

async function isConnectionAllowedForUser(userId, connectionId) {
  const allowed = await getAllowedConnectionIds(userId);
  if (allowed === null) return true;
  return allowed.includes(Number(connectionId));
}

/** Danh sach toan bo tai khoan kem danh sach he thong dang gioi han (rong = khong gioi han) -
 * phuc vu man hinh "Tai khoan". */
async function listUserAccess() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT u.UserID AS userId, s.ConnectionId AS connectionId, c.Name AS connectionName
    FROM dbo.Users u
    LEFT JOIN dbo.UserVoucherSystems s ON s.UserId = u.UserID
    LEFT JOIN dbo.ApiConnections c ON c.Id = s.ConnectionId
    ORDER BY u.UserID
  `);
  const byUser = new Map();
  for (const row of result.recordset) {
    if (!byUser.has(row.userId)) byUser.set(row.userId, []);
    if (row.connectionId) byUser.get(row.userId).push({ connectionId: row.connectionId, connectionName: row.connectionName });
  }
  return byUser;
}

/** Thay toan bo danh sach he thong duoc phep cua 1 tai khoan - mang rong = go gioi han (ve
 * "khong gioi han", KHONG PHAI "khong duoc dung he thong nao"). */
async function setAllowedConnections(userId, connectionIds) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await transaction.request().input('userId', sql.Int, userId).query('DELETE FROM dbo.UserVoucherSystems WHERE UserId = @userId');
    for (const connectionId of connectionIds || []) {
      // eslint-disable-next-line no-await-in-loop
      await transaction
        .request()
        .input('userId', sql.Int, userId)
        .input('connectionId', sql.Int, connectionId)
        .query('INSERT INTO dbo.UserVoucherSystems (UserId, ConnectionId) VALUES (@userId, @connectionId)');
    }
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

module.exports = {
  getAllowedConnectionIds,
  getAllowedConnectionIdsForLocation,
  isConnectionAllowedForUser,
  listUserAccess,
  setAllowedConnections,
};
