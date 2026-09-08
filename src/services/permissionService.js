const { sql, getPool } = require('../config/db');

/** Quyen mac dinh khi 1 tai khoan nhan vien CHUA co dong nao trong VoucherAppPermissions
 * (tai khoan cu tu truoc khi co tinh nang nay, hoac vua tao xong) - phai khop DUNG voi
 * DEFAULT cua bang trong sql/014, tranh lech hanh vi giua "co dong" va "chua co dong". */
const DEFAULT_PERMISSIONS = {
  canRedeemVoucher: true,
  canViewReconciliation: true,
  canViewSummary: false,
  canViewUsedVouchers: false,
};

/** Admin (Users.status = 1) luon co du moi quyen, khong phu thuoc bang nay. */
const ADMIN_PERMISSIONS = {
  canRedeemVoucher: true,
  canViewReconciliation: true,
  canViewSummary: true,
  canViewUsedVouchers: true,
};

async function getPermissions(userId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT CanRedeemVoucher, CanViewReconciliation, CanViewSummary, CanViewUsedVouchers
      FROM dbo.VoucherAppPermissions
      WHERE UserId = @userId
    `);
  const row = result.recordset[0];
  if (!row) return { ...DEFAULT_PERMISSIONS };
  return {
    canRedeemVoucher: !!row.CanRedeemVoucher,
    canViewReconciliation: !!row.CanViewReconciliation,
    canViewSummary: !!row.CanViewSummary,
    canViewUsedVouchers: !!row.CanViewUsedVouchers,
  };
}

/** Quyen thuc te cua 1 tai khoan, da tinh ca truong hop admin (luon full quyen). */
async function resolvePermissions({ userId, role }) {
  if (Number(role) === 1) return { ...ADMIN_PERMISSIONS };
  return getPermissions(userId);
}

async function setPermissions(userId, perms, updatedBy) {
  const pool = await getPool();
  await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('canRedeem', sql.Bit, perms.canRedeemVoucher ? 1 : 0)
    .input('canRecon', sql.Bit, perms.canViewReconciliation ? 1 : 0)
    .input('canSummary', sql.Bit, perms.canViewSummary ? 1 : 0)
    .input('canUsed', sql.Bit, perms.canViewUsedVouchers ? 1 : 0)
    .input('updatedBy', sql.NVarChar(100), updatedBy || null)
    .query(`
      MERGE dbo.VoucherAppPermissions AS target
      USING (SELECT @userId AS UserId) AS src
      ON target.UserId = src.UserId
      WHEN MATCHED THEN UPDATE SET
        CanRedeemVoucher = @canRedeem, CanViewReconciliation = @canRecon,
        CanViewSummary = @canSummary, CanViewUsedVouchers = @canUsed,
        UpdatedBy = @updatedBy, UpdatedDate = GETDATE()
      WHEN NOT MATCHED THEN INSERT
        (UserId, CanRedeemVoucher, CanViewReconciliation, CanViewSummary, CanViewUsedVouchers, UpdatedBy, UpdatedDate)
        VALUES (@userId, @canRedeem, @canRecon, @canSummary, @canUsed, @updatedBy, GETDATE());
    `);
}

/** Tao dong quyen MAC DINH cho 1 tai khoan vua tao (ghi ro rang thay vi de trong/ngam dinh,
 * de admin thay va sua ngay tu dau neu can). */
async function createDefaultPermissions(userId, createdBy) {
  await setPermissions(userId, DEFAULT_PERMISSIONS, createdBy);
}

module.exports = {
  DEFAULT_PERMISSIONS,
  ADMIN_PERMISSIONS,
  getPermissions,
  resolvePermissions,
  setPermissions,
  createDefaultPermissions,
};
