-- =====================================================================
-- 041_add_feature_permissions.sql
-- v3.81: them quyen tinh nang CHI TIET HON cho 2 tang quan tri hien co, theo
-- yeu cau "chuc nang nao khong duoc phan quyen thi khong hien ra tren menu":
--
-- 1. 4 cot PartnerAdminCanXxx - cho tai khoan "Quan tri doi tac" (xem
--    requirePartnerAdmin.js): truoc day luon thay DU CA 4 tab cua man hinh
--    "Quan tri doi tac" mien la duoc gan quyen nay, khong phan biet duoc
--    tung tab. Tu ban nay, HCRC co the bo tick rieng tung tab khi gan quyen
--    (xem user.controller.js#updatePartnerAdmin) - tab khong duoc tick se
--    AN khoi menu CUA DOI TAC DO va bi CHAN o API (khong chi an giao dien).
--
-- 2. 5 cot AdminCanXxx - cho tai khoan Quan tri DAY DU (role=1): truoc day
--    MOI tai khoan Quan tri luon co du ca 5 man hinh "Quan tri" (Don vi thu
--    hoi/Ket noi API/Tai khoan/Nhat ky he thong/Thiet lap email), khong co
--    cach gioi han rieng 1 tai khoan Quan tri chi lam 1 viec cu the (vd ke
--    toan chi can "Tai khoan" + "Nhat ky he thong"). Tu ban nay dung duoc
--    (xem requireRole.js#requireAdminFeature, sua tu requireAdmin).
--
-- DEFAULT 1 (bat) cho CA 9 cot - dam bao MOI tai khoan dang co san (ca
-- "Quan tri doi tac" lan "Quan tri" day du) giu NGUYEN hanh vi hien tai sau
-- khi chay migration nay (thay doi ADD COLUMN...DEFAULT 1 tren 1 cot NOT
-- NULL se tu dong dien gia tri 1 cho MOI dong da co san trong SQL Server) -
-- khong ai bi mat quyen dot ngot, admin/doi tac chi bi gioi han khi co
-- nguoi CHU DONG bo tick 1 muc nao do sau nay.
-- =====================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'PartnerAdminCanManageAccounts'
)
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD PartnerAdminCanManageAccounts BIT NOT NULL CONSTRAINT DF_VAP_PartnerAdminCanManageAccounts DEFAULT 1;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'PartnerAdminCanManageOrg'
)
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD PartnerAdminCanManageOrg BIT NOT NULL CONSTRAINT DF_VAP_PartnerAdminCanManageOrg DEFAULT 1;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'PartnerAdminCanViewAuditLog'
)
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD PartnerAdminCanViewAuditLog BIT NOT NULL CONSTRAINT DF_VAP_PartnerAdminCanViewAuditLog DEFAULT 1;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'PartnerAdminCanViewScanLog'
)
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD PartnerAdminCanViewScanLog BIT NOT NULL CONSTRAINT DF_VAP_PartnerAdminCanViewScanLog DEFAULT 1;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'AdminCanManageUnits'
)
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD AdminCanManageUnits BIT NOT NULL CONSTRAINT DF_VAP_AdminCanManageUnits DEFAULT 1;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'AdminCanManageConnections'
)
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD AdminCanManageConnections BIT NOT NULL CONSTRAINT DF_VAP_AdminCanManageConnections DEFAULT 1;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'AdminCanManageUsers'
)
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD AdminCanManageUsers BIT NOT NULL CONSTRAINT DF_VAP_AdminCanManageUsers DEFAULT 1;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'AdminCanViewAdminLog'
)
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD AdminCanViewAdminLog BIT NOT NULL CONSTRAINT DF_VAP_AdminCanViewAdminLog DEFAULT 1;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'AdminCanManageEmailSettings'
)
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD AdminCanManageEmailSettings BIT NOT NULL CONSTRAINT DF_VAP_AdminCanManageEmailSettings DEFAULT 1;
END
GO
