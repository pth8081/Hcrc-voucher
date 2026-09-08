-- =====================================================================
-- 015_create_admin_audit_log.sql
-- Nhat ky thao tac QUAN TRI (tao tai khoan, doi quyen, doi lich hieu luc,
-- go 2FA nguoi khac...) - khac voi VoucherScanLogs (nhat ky QUET/THU HOI
-- voucher cua nhan vien tai quay). Can thiet khi mo rong tinh nang phan
-- quyen chi tiet: biet duoc AI da doi quyen cua AI, luc nao.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AdminAuditLog' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.AdminAuditLog (
        Id              BIGINT IDENTITY(1,1) PRIMARY KEY,
        ActorUsername   NVARCHAR(100) NOT NULL,   -- ai thuc hien thao tac
        Action          NVARCHAR(100) NOT NULL,   -- vd 'CREATE_USER', 'UPDATE_PERMISSIONS'...
        TargetUsername  NVARCHAR(100) NULL,       -- tai khoan bi tac dong (neu co)
        Detail          NVARCHAR(MAX) NULL,       -- JSON mo ta ngan gon thay doi
        CreatedDate     DATETIME NOT NULL DEFAULT (GETDATE())
    );

    CREATE INDEX IX_AdminAuditLog_CreatedDate ON dbo.AdminAuditLog (CreatedDate);
    CREATE INDEX IX_AdminAuditLog_TargetUsername ON dbo.AdminAuditLog (TargetUsername);
END
GO
