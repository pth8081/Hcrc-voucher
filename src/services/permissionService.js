const { sql, getPool } = require('../config/db');

/** Quyen mac dinh khi 1 tai khoan nhan vien CHUA co dong nao trong VoucherAppPermissions
 * (tai khoan cu tu truoc khi co tinh nang nay, hoac vua tao xong) - phai khop DUNG voi
 * DEFAULT cua bang trong sql/014, tranh lech hanh vi giua "co dong" va "chua co dong". */
const DEFAULT_PERMISSIONS = {
  canRedeemVoucher: true,
  canViewReconciliation: true,
  canViewSummary: false,
  canViewUsedVouchers: false,
  canViewBusinessGuide: true,
  canViewSystemGuide: false,
  // v3.84: quyen tinh nang thu 7, TACH RIENG khoi 3 quyen xem bao cao (canViewReconciliation/
  // ...Summary/...UsedVouchers) - truoc day co 1 trong 3 quyen do la TU DONG thay duoc muc "Lich
  // gui email bao cao", khong co cong tac rieng. Mac dinh TAT (false) cho tai khoan moi/chua tung
  // dung - theo yeu cau nguoi dung: nguoi THIET LAP lich gui email phai la Quan tri doi tac/Quan
  // tri day du, hoac 1 nhan vien duoc cap RIENG quyen nay (xem sql/042, setPartnerAdminConnection()
  // o duoi - tu dong BAT quyen nay ngay khi 1 tai khoan duoc gan "Quan tri doi tac").
  canManageEmailSchedules: false,
  // M16: quan tri GIOI HAN theo 1 he thong voucher cu the (vd cap cho doi tac Fuji 1 tai khoan tu
  // xem/tao/khoa cac tai khoan CHI dung Fuji cua chinh ho - xem partnerAdminService.js). null =
  // tai khoan thuong; isPartnerAdmin/partnerAdminConnectionName la 2 gia tri SUY RA (khong luu
  // rieng) de tien dung truc tiep o frontend (layout.js#NAV_ITEMS, partner-admin.js) ma khong can
  // tinh lai moi lan.
  partnerAdminConnectionId: null,
  partnerAdminConnectionName: null,
  isPartnerAdmin: false,
  // M20 (v3.81): 4 quyen con cua rieng man hinh "Quan tri doi tac" - 1 tab KHONG duoc tick se AN
  // khoi menu cua doi tac do VA bi chan o API (xem requirePartnerAdmin.js#requirePartnerAdminFeature).
  // Mac dinh true CA 4 (giu dung hanh vi "thay du 4 tab" tu truoc khi co quyen con nay).
  partnerAdminCanManageAccounts: true,
  partnerAdminCanManageOrg: true,
  partnerAdminCanViewAuditLog: true,
  partnerAdminCanViewScanLog: true,
};

/** Admin (Users.status = 1) luon co du moi quyen TINH NANG UNG DUNG (6 quyen dau), khong phu
 * thuoc bang nay - khong can/khong the la "quan tri gioi han" cap do nay (ho da la quan tri DAY
 * DU). M20 (v3.81): RIENG 5 quyen AdminCanXxx (man hinh "Quan tri") moi doc THAT tu DB cho tai
 * khoan Quan tri - xem resolvePermissions() - default moi mang true neu chua co dong du lieu. */
const ADMIN_PERMISSIONS = {
  canRedeemVoucher: true,
  canViewReconciliation: true,
  canViewSummary: true,
  canViewUsedVouchers: true,
  canViewBusinessGuide: true,
  canViewSystemGuide: true,
  canManageEmailSchedules: true,
  partnerAdminConnectionId: null,
  partnerAdminConnectionName: null,
  isPartnerAdmin: false,
  adminCanManageUnits: true,
  adminCanManageConnections: true,
  adminCanManageUsers: true,
  adminCanViewAdminLog: true,
  adminCanManageEmailSettings: true,
};

const FEATURE_COLUMNS_SELECT = `
  p.PartnerAdminCanManageAccounts, p.PartnerAdminCanManageOrg, p.PartnerAdminCanViewAuditLog, p.PartnerAdminCanViewScanLog,
  p.AdminCanManageUnits, p.AdminCanManageConnections, p.AdminCanManageUsers, p.AdminCanViewAdminLog, p.AdminCanManageEmailSettings
`;

async function getPermissions(userId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT p.CanRedeemVoucher, p.CanViewReconciliation, p.CanViewSummary, p.CanViewUsedVouchers,
             p.CanViewBusinessGuide, p.CanViewSystemGuide, p.CanManageEmailSchedules, p.PartnerAdminConnectionId,
             c.Name AS PartnerAdminConnectionName, ${FEATURE_COLUMNS_SELECT}
      FROM dbo.VoucherAppPermissions p
      LEFT JOIN dbo.ApiConnections c ON c.Id = p.PartnerAdminConnectionId
      WHERE p.UserId = @userId
    `);
  const row = result.recordset[0];
  if (!row) return { ...DEFAULT_PERMISSIONS };
  return {
    canRedeemVoucher: !!row.CanRedeemVoucher,
    canViewReconciliation: !!row.CanViewReconciliation,
    canViewSummary: !!row.CanViewSummary,
    canViewUsedVouchers: !!row.CanViewUsedVouchers,
    canViewBusinessGuide: !!row.CanViewBusinessGuide,
    canViewSystemGuide: !!row.CanViewSystemGuide,
    canManageEmailSchedules: !!row.CanManageEmailSchedules,
    // Ket noi da bi xoa (khong con trong ApiConnections) sau khi duoc gan lam partner-admin: coi
    // nhu KHONG con la partner-admin nua (an toan hon la giu quyen "treo" vao 1 he thong khong
    // con ton tai) - LEFT JOIN tra ve PartnerAdminConnectionName = NULL trong truong hop nay.
    partnerAdminConnectionId: row.PartnerAdminConnectionName ? row.PartnerAdminConnectionId : null,
    partnerAdminConnectionName: row.PartnerAdminConnectionName || null,
    isPartnerAdmin: !!row.PartnerAdminConnectionName,
    partnerAdminCanManageAccounts: !!row.PartnerAdminCanManageAccounts,
    partnerAdminCanManageOrg: !!row.PartnerAdminCanManageOrg,
    partnerAdminCanViewAuditLog: !!row.PartnerAdminCanViewAuditLog,
    partnerAdminCanViewScanLog: !!row.PartnerAdminCanViewScanLog,
  };
}

/** Rieng 5 quyen man hinh "Quan tri" (AdminCanXxx) cua 1 tai khoan Quan tri DAY DU - dung boi
 * requireRole.js#requireAdminFeature (chan API) va authService.js#issueSession (qua
 * resolvePermissions). Tach rieng khoi getPermissions() vi getPermissions() tra DEFAULT_PERMISSIONS
 * (quyen nhan vien thuong) khi chua co dong du lieu - KHONG dung duoc cho tai khoan Quan tri (can
 * default TOAN BO true, khong phai chi 2 quyen dau nhu DEFAULT_PERMISSIONS). */
async function getAdminFeaturePermissions(userId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .query(`SELECT ${FEATURE_COLUMNS_SELECT} FROM dbo.VoucherAppPermissions p WHERE p.UserId = @userId`);
  const row = result.recordset[0];
  if (!row) {
    return {
      adminCanManageUnits: true,
      adminCanManageConnections: true,
      adminCanManageUsers: true,
      adminCanViewAdminLog: true,
      adminCanManageEmailSettings: true,
    };
  }
  return {
    adminCanManageUnits: !!row.AdminCanManageUnits,
    adminCanManageConnections: !!row.AdminCanManageConnections,
    adminCanManageUsers: !!row.AdminCanManageUsers,
    adminCanViewAdminLog: !!row.AdminCanViewAdminLog,
    adminCanManageEmailSettings: !!row.AdminCanManageEmailSettings,
  };
}

/** Quyen thuc te cua 1 tai khoan, da tinh ca truong hop admin (luon full quyen UNG DUNG, rieng 5
 * quyen man hinh "Quan tri" doc THAT tu DB - xem ghi chu M20 o ADMIN_PERMISSIONS). */
async function resolvePermissions({ userId, role }) {
  if (Number(role) === 1) return { ...ADMIN_PERMISSIONS, ...(await getAdminFeaturePermissions(userId)) };
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
    .input('canBusinessGuide', sql.Bit, perms.canViewBusinessGuide ? 1 : 0)
    .input('canSystemGuide', sql.Bit, perms.canViewSystemGuide ? 1 : 0)
    .input('canEmailSchedules', sql.Bit, perms.canManageEmailSchedules ? 1 : 0)
    .input('updatedBy', sql.NVarChar(100), updatedBy || null)
    .query(`
      MERGE dbo.VoucherAppPermissions AS target
      USING (SELECT @userId AS UserId) AS src
      ON target.UserId = src.UserId
      WHEN MATCHED THEN UPDATE SET
        CanRedeemVoucher = @canRedeem, CanViewReconciliation = @canRecon,
        CanViewSummary = @canSummary, CanViewUsedVouchers = @canUsed,
        CanViewBusinessGuide = @canBusinessGuide, CanViewSystemGuide = @canSystemGuide,
        CanManageEmailSchedules = @canEmailSchedules,
        UpdatedBy = @updatedBy, UpdatedDate = GETDATE()
      WHEN NOT MATCHED THEN INSERT
        (UserId, CanRedeemVoucher, CanViewReconciliation, CanViewSummary, CanViewUsedVouchers,
         CanViewBusinessGuide, CanViewSystemGuide, CanManageEmailSchedules, UpdatedBy, UpdatedDate)
        VALUES (@userId, @canRedeem, @canRecon, @canSummary, @canUsed,
                @canBusinessGuide, @canSystemGuide, @canEmailSchedules, @updatedBy, GETDATE());
    `);
}

/**
 * Tu dong CAP (khong bao gio GO) quyen "Lich gui email bao cao" (v3.84) cho 1 tai khoan NGAY KHI
 * duoc gan "Quan tri doi tac" - goi tu user.controller.js#updatePartnerAdmin, CHI khi GAN
 * (connectionId truthy), KHONG BAO GIO khi GO (giu nguyen gia tri hien co, dung nguyen tac "chi
 * CAP THEM, khong tu dong THU HOI" - giong cach UserVoucherSystems duoc xu ly o cung ham do).
 * Tach rieng (khong dung chung MERGE voi setPermissions()) de KHONG vo tinh ghi de 6 quyen tinh
 * nang khac dang co san cua tai khoan khi chi dang gan quyen "Quan tri doi tac".
 */
async function grantEmailScheduleAccess(userId, updatedBy) {
  const pool = await getPool();
  await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('updatedBy', sql.NVarChar(100), updatedBy || null)
    .query(`
      MERGE dbo.VoucherAppPermissions AS target
      USING (SELECT @userId AS UserId) AS src
      ON target.UserId = src.UserId
      WHEN MATCHED THEN UPDATE SET CanManageEmailSchedules = 1, UpdatedBy = @updatedBy, UpdatedDate = GETDATE()
      WHEN NOT MATCHED THEN INSERT
        (UserId, CanRedeemVoucher, CanViewReconciliation, CanViewSummary, CanViewUsedVouchers,
         CanViewBusinessGuide, CanViewSystemGuide, CanManageEmailSchedules, UpdatedBy, UpdatedDate)
        VALUES (@userId, 1, 1, 0, 0, 1, 0, 1, @updatedBy, GETDATE());
    `);
}

/**
 * Gan/go quyen "quan tri gioi han theo 1 he thong voucher" (partner-admin) cho 1 tai khoan -
 * xem ghi chu M16 o DEFAULT_PERMISSIONS. CHI UPDATE/INSERT rieng cot nay (khong dung chung MERGE
 * voi setPermissions() o tren) de KHONG vo tinh ghi de cac quyen tinh nang khac dang co san khi
 * admin chi dang bat/tat quyen nay - 2 thao tac phai doc lap hoan toan voi nhau.
 *
 * connectionId = null -> go quyen (tai khoan tro thanh nhan vien thuong tro lai). Khong tu dong
 * doi UserVoucherSystems cua chinh tai khoan do o day - xem ghi chu o user.controller.js#
 * updatePartnerAdmin (chi ep ve [connectionId] khi GAN, giu nguyen khi GO).
 */
async function setPartnerAdminConnection(userId, connectionId, updatedBy) {
  const pool = await getPool();
  await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('connectionId', sql.Int, connectionId || null)
    .input('updatedBy', sql.NVarChar(100), updatedBy || null)
    .query(`
      MERGE dbo.VoucherAppPermissions AS target
      USING (SELECT @userId AS UserId) AS src
      ON target.UserId = src.UserId
      WHEN MATCHED THEN UPDATE SET
        PartnerAdminConnectionId = @connectionId, UpdatedBy = @updatedBy, UpdatedDate = GETDATE()
      WHEN NOT MATCHED THEN INSERT
        (UserId, CanRedeemVoucher, CanViewReconciliation, CanViewSummary, CanViewUsedVouchers,
         CanViewBusinessGuide, CanViewSystemGuide, PartnerAdminConnectionId, UpdatedBy, UpdatedDate)
        VALUES (@userId, 1, 1, 0, 0, 1, 0, @connectionId, @updatedBy, GETDATE());
    `);
}

/**
 * Doi 4 quyen con cua rieng man hinh "Quan tri doi tac" (tung tab) cho 1 tai khoan - goi tu
 * user.controller.js#updatePartnerAdmin CUNG LUC voi setPartnerAdminConnection() (ca 2 deu
 * MERGE tren CUNG 1 dong VoucherAppPermissions nen khong xung dot). Tach rieng ham (khong gop
 * chung 1 cau MERGE) de co the tai su dung doc lap neu can sau nay.
 */
async function setPartnerAdminTabPermissions(userId, perms, updatedBy) {
  const pool = await getPool();
  await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('canManageAccounts', sql.Bit, perms.canManageAccounts ? 1 : 0)
    .input('canManageOrg', sql.Bit, perms.canManageOrg ? 1 : 0)
    .input('canViewAuditLog', sql.Bit, perms.canViewAuditLog ? 1 : 0)
    .input('canViewScanLog', sql.Bit, perms.canViewScanLog ? 1 : 0)
    .input('updatedBy', sql.NVarChar(100), updatedBy || null)
    .query(`
      MERGE dbo.VoucherAppPermissions AS target
      USING (SELECT @userId AS UserId) AS src
      ON target.UserId = src.UserId
      WHEN MATCHED THEN UPDATE SET
        PartnerAdminCanManageAccounts = @canManageAccounts, PartnerAdminCanManageOrg = @canManageOrg,
        PartnerAdminCanViewAuditLog = @canViewAuditLog, PartnerAdminCanViewScanLog = @canViewScanLog,
        UpdatedBy = @updatedBy, UpdatedDate = GETDATE()
      WHEN NOT MATCHED THEN INSERT
        (UserId, CanRedeemVoucher, CanViewReconciliation, CanViewSummary, CanViewUsedVouchers,
         CanViewBusinessGuide, CanViewSystemGuide, PartnerAdminCanManageAccounts, PartnerAdminCanManageOrg,
         PartnerAdminCanViewAuditLog, PartnerAdminCanViewScanLog, UpdatedBy, UpdatedDate)
        VALUES (@userId, 1, 1, 0, 0, 1, 0, @canManageAccounts, @canManageOrg,
                @canViewAuditLog, @canViewScanLog, @updatedBy, GETDATE());
    `);
}

/**
 * Doi 5 quyen man hinh "Quan tri" (AdminCanXxx) cho 1 tai khoan Quan tri DAY DU - goi tu
 * user.controller.js#updateAdminFeaturePermissions (man hinh "Tai khoan", chi tai khoan Quan tri
 * khac moi sua duoc, KHONG tu sua duoc chinh minh - xem ghi chu o controller, tranh tu khoa het
 * quyen vao lai man "Tai khoan" de mo lai cho chinh minh).
 */
async function setAdminFeaturePermissions(userId, perms, updatedBy) {
  const pool = await getPool();
  await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('canManageUnits', sql.Bit, perms.canManageUnits ? 1 : 0)
    .input('canManageConnections', sql.Bit, perms.canManageConnections ? 1 : 0)
    .input('canManageUsers', sql.Bit, perms.canManageUsers ? 1 : 0)
    .input('canViewAdminLog', sql.Bit, perms.canViewAdminLog ? 1 : 0)
    .input('canManageEmailSettings', sql.Bit, perms.canManageEmailSettings ? 1 : 0)
    .input('updatedBy', sql.NVarChar(100), updatedBy || null)
    .query(`
      MERGE dbo.VoucherAppPermissions AS target
      USING (SELECT @userId AS UserId) AS src
      ON target.UserId = src.UserId
      WHEN MATCHED THEN UPDATE SET
        AdminCanManageUnits = @canManageUnits, AdminCanManageConnections = @canManageConnections,
        AdminCanManageUsers = @canManageUsers, AdminCanViewAdminLog = @canViewAdminLog,
        AdminCanManageEmailSettings = @canManageEmailSettings, UpdatedBy = @updatedBy, UpdatedDate = GETDATE()
      WHEN NOT MATCHED THEN INSERT
        (UserId, CanRedeemVoucher, CanViewReconciliation, CanViewSummary, CanViewUsedVouchers,
         CanViewBusinessGuide, CanViewSystemGuide, AdminCanManageUnits, AdminCanManageConnections,
         AdminCanManageUsers, AdminCanViewAdminLog, AdminCanManageEmailSettings, UpdatedBy, UpdatedDate)
        VALUES (@userId, 1, 1, 1, 1, 1, 1, @canManageUnits, @canManageConnections,
                @canManageUsers, @canViewAdminLog, @canManageEmailSettings, @updatedBy, GETDATE());
    `);
}

/** Tao dong quyen MAC DINH cho 1 tai khoan vua tao (ghi ro rang thay vi de trong/ngam dinh,
 * de admin thay va sua ngay tu dau neu can). */
async function createDefaultPermissions(userId, createdBy) {
  await setPermissions(userId, DEFAULT_PERMISSIONS, createdBy);
}

/**
 * Ghi nho DUNG 1 LAN (xem sql/035) rang tai khoan nay BAN DAU do 1 "Quan tri doi tac" tu tao ra
 * qua man hinh tu phuc vu - goi DUY NHAT 1 lan, ngay sau khi tao tai khoan xong
 * (partnerAdminService.js#createScopedUser), KHONG BAO GIO goi lai o bat ky noi nao khac (gia
 * tri nay phai co dinh vinh vien theo thoi gian, khac han UserVoucherSystems co the doi qua lai).
 */
async function setCreatedByPartnerConnection(userId, connectionId) {
  const pool = await getPool();
  await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('connectionId', sql.Int, connectionId)
    .query('UPDATE dbo.VoucherAppPermissions SET CreatedByPartnerConnectionId = @connectionId WHERE UserId = @userId');
}

/** Map<userId, connectionId> - CHI gom cac tai khoan co CreatedByPartnerConnectionId (xem
 * sql/035) - dung boi partnerAdminService.js#listScopedUsers() de loc dung tai khoan DO CHINH
 * doi tac nay tao ra, KHONG PHAI moi tai khoan dang dung he thong cua ho (vd 1 tai khoan do quan
 * tri day du HCRC tao, duoc cap them he thong Fuji sau nay, se KHONG xuat hien trong map nay -
 * dung y, vi HCRC moi la nguoi tao ra no). */
async function listCreatedByPartnerConnection() {
  const pool = await getPool();
  const result = await pool.request().query(
    'SELECT UserId, CreatedByPartnerConnectionId FROM dbo.VoucherAppPermissions WHERE CreatedByPartnerConnectionId IS NOT NULL'
  );
  const map = new Map();
  for (const row of result.recordset) map.set(row.UserId, row.CreatedByPartnerConnectionId);
  return map;
}

module.exports = {
  DEFAULT_PERMISSIONS,
  ADMIN_PERMISSIONS,
  getPermissions,
  getAdminFeaturePermissions,
  resolvePermissions,
  setPermissions,
  grantEmailScheduleAccess,
  setPartnerAdminConnection,
  setPartnerAdminTabPermissions,
  setAdminFeaturePermissions,
  createDefaultPermissions,
  setCreatedByPartnerConnection,
  listCreatedByPartnerConnection,
};
