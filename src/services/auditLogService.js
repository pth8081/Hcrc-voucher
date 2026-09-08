const { sql, getPool } = require('../config/db');

/** Ghi 1 dong nhat ky thao tac QUAN TRI - khong bao gio throw ra ngoai (log that bai khong
 * duoc lam hong thao tac chinh dang thuc hien), chi in loi ra console de biet neu co su co. */
async function log({ actorUsername, action, targetUsername, detail }) {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input('actor', sql.NVarChar(100), actorUsername || null)
      .input('action', sql.NVarChar(100), action)
      .input('target', sql.NVarChar(100), targetUsername || null)
      .input('detail', sql.NVarChar(sql.MAX), detail ? JSON.stringify(detail) : null)
      .query(`
        INSERT INTO dbo.AdminAuditLog (ActorUsername, Action, TargetUsername, Detail, CreatedDate)
        VALUES (@actor, @action, @target, @detail, GETDATE())
      `);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Ghi AdminAuditLog that bai:', err.message);
  }
}

async function list({ limit }) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('limit', sql.Int, Math.min(Number(limit) || 200, 1000))
    .query(`
      SELECT TOP (@limit) Id, ActorUsername, Action, TargetUsername, Detail, CreatedDate
      FROM dbo.AdminAuditLog
      ORDER BY CreatedDate DESC
    `);
  return result.recordset;
}

module.exports = { log, list };
