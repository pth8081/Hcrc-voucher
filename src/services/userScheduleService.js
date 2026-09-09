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
    .query('SELECT ActiveFrom, ActiveUntil, IsDeleted, UpdatedBy, UpdatedDate FROM dbo.UserAccountSchedule WHERE UserId = @userId');
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

/** Chan dang nhap neu tai khoan chua den han, da het han, hoac da bi XOA MEM (nut "Xoa" o man
 * hinh Tai khoan) - goi SAU KHI da xac minh danh tinh (mat khau/van tay) dung, KHONG tinh vao
 * bo dem loginGuard vi day khong phai go sai. */
async function assertAccountActive(userId) {
  const schedule = await getSchedule(userId);
  if (schedule && schedule.IsDeleted) {
    throw forbidden('Tai khoan nay da bi xoa. Vui long lien he quan tri vien.');
  }
  const result = evaluate(schedule);
  if (result.state === 'not_yet_active') {
    throw forbidden(`Tai khoan chua den thoi gian duoc kich hoat (co hieu luc tu ${fmtVn(result.activeFrom)}).`);
  }
  if (result.state === 'expired') {
    throw forbidden(`Tai khoan da het han su dung tu ${fmtVn(result.activeUntil)}. Vui long lien he quan tri de gia han.`);
  }
}

/** Danh sach toan bo tai khoan kem lich hieu luc + trang thai hien tai - phuc vu man hinh quan
 * tri. Mac dinh (includeDeleted=false) AN cac tai khoan da bi xoa mem, dung cho man hinh
 * thuong ngay; dat includeDeleted=true de xem lai/khoi phuc. */
async function listAllWithSchedule(includeDeleted = false) {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT u.UserID AS userId, u.Username AS username, u.FullName AS fullName, u.status AS role,
           LTRIM(RTRIM(u.Locations_Detail)) AS locationsDetail,
           s.ActiveFrom AS activeFrom, s.ActiveUntil AS activeUntil,
           ISNULL(s.IsDeleted, 0) AS isDeleted,
           s.UpdatedBy AS updatedBy, s.UpdatedDate AS updatedDate
    FROM dbo.Users u
    LEFT JOIN dbo.UserAccountSchedule s ON s.UserId = u.UserID
    ORDER BY u.Username ASC
  `);
  const now = new Date();
  return result.recordset
    .filter((row) => includeDeleted || !row.isDeleted)
    .map((row) => ({
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

/** Xoa mem / khoi phuc 1 tai khoan (nut "Xoa"/"Khoi phuc" o man hinh Tai khoan) - chi danh
 * dau co, KHONG xoa dong nao trong dbo.Users (bang dung chung voi Core/vpdt-dms). */
async function setDeleted(userId, isDeleted, updatedBy) {
  const pool = await getPool();
  await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('isDeleted', sql.Bit, isDeleted ? 1 : 0)
    .input('updatedBy', sql.NVarChar(100), updatedBy || null)
    .query(`
      MERGE dbo.UserAccountSchedule AS target
      USING (SELECT @userId AS UserId) AS src
      ON target.UserId = src.UserId
      WHEN MATCHED THEN UPDATE SET IsDeleted = @isDeleted,
        DeletedDate = CASE WHEN @isDeleted = 1 THEN GETDATE() ELSE NULL END,
        UpdatedBy = @updatedBy, UpdatedDate = GETDATE()
      WHEN NOT MATCHED THEN INSERT (UserId, IsDeleted, DeletedDate, UpdatedBy, UpdatedDate)
        VALUES (@userId, @isDeleted, CASE WHEN @isDeleted = 1 THEN GETDATE() ELSE NULL END, @updatedBy, GETDATE());
    `);
}

module.exports = { getSchedule, evaluate, assertAccountActive, listAllWithSchedule, upsertSchedule, setDeleted };
