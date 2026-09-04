const { sql, getPool } = require('../config/db');

function forbidden(message) {
  const err = new Error(message);
  err.statusCode = 403;
  err.publicMessage = message;
  return err;
}

function fmtVn(date) {
  return new Date(date).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

/** Doc lich hieu luc cua 1 tai khoan. Tra ve null neu chua tung dat (= khong gioi han). */
async function getSchedule(userId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .query('SELECT ActiveFrom, ActiveUntil, UpdatedBy, UpdatedDate FROM dbo.UserAccountSchedule WHERE UserId = @userId');
  return result.recordset[0] || null;
}

/**
 * Danh gia 1 lich theo thoi diem HIEN TAI (khong luu trang thai "khoa/mo" rieng - luon tinh
 * song tu 2 moc ActiveFrom/ActiveUntil nen khong bao gio lech, khong can job nen).
 */
function evaluate(schedule, now = new Date()) {
  if (!schedule) return { state: 'active' };
  if (schedule.ActiveFrom && now < new Date(schedule.ActiveFrom)) {
    return { state: 'not_yet_active', activeFrom: schedule.ActiveFrom };
  }
  if (schedule.ActiveUntil && now > new Date(schedule.ActiveUntil)) {
    return { state: 'expired', activeUntil: schedule.ActiveUntil };
  }
  return { state: 'active' };
}

/** Chan dang nhap neu tai khoan chua den han hoac da het han - goi SAU KHI da xac minh danh
 * tinh (mat khau/van tay) dung, KHONG tinh vao bo dem loginGuard vi day khong phai go sai. */
async function assertAccountActive(userId) {
  const schedule = await getSchedule(userId);
  const result = evaluate(schedule);
  if (result.state === 'not_yet_active') {
    throw forbidden(`Tai khoan chua den thoi gian duoc kich hoat (co hieu luc tu ${fmtVn(result.activeFrom)}).`);
  }
  if (result.state === 'expired') {
    throw forbidden(`Tai khoan da het han su dung tu ${fmtVn(result.activeUntil)}. Vui long lien he quan tri de gia han.`);
  }
}

/** Danh sach toan bo tai khoan kem lich hieu luc + trang thai hien tai - phuc vu man hinh quan tri. */
async function listAllWithSchedule() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT u.UserID AS userId, u.Username AS username, u.FullName AS fullName, u.status AS role,
           s.ActiveFrom AS activeFrom, s.ActiveUntil AS activeUntil,
           s.UpdatedBy AS updatedBy, s.UpdatedDate AS updatedDate
    FROM dbo.Users u
    LEFT JOIN dbo.UserAccountSchedule s ON s.UserId = u.UserID
    ORDER BY u.Username ASC
  `);
  const now = new Date();
  return result.recordset.map((row) => ({
    ...row,
    state: evaluate({ ActiveFrom: row.activeFrom, ActiveUntil: row.activeUntil }, now).state,
  }));
}

/** activeFrom/activeUntil: chuoi ISO hoac null (null = go gioi han o moc do). */
async function upsertSchedule(userId, { activeFrom, activeUntil }, updatedBy) {
  const pool = await getPool();
  await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('activeFrom', sql.DateTime, activeFrom ? new Date(activeFrom) : null)
    .input('activeUntil', sql.DateTime, activeUntil ? new Date(activeUntil) : null)
    .input('updatedBy', sql.NVarChar(100), updatedBy || null)
    .query(`
      MERGE dbo.UserAccountSchedule AS target
      USING (SELECT @userId AS UserId) AS src
      ON target.UserId = src.UserId
      WHEN MATCHED THEN UPDATE SET ActiveFrom = @activeFrom, ActiveUntil = @activeUntil,
        UpdatedBy = @updatedBy, UpdatedDate = GETDATE()
      WHEN NOT MATCHED THEN INSERT (UserId, ActiveFrom, ActiveUntil, UpdatedBy, UpdatedDate)
        VALUES (@userId, @activeFrom, @activeUntil, @updatedBy, GETDATE());
    `);
}

module.exports = { getSchedule, evaluate, assertAccountActive, listAllWithSchedule, upsertSchedule };
