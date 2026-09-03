-- =====================================================================
-- 002_create_voucher_scan_logs.sql
-- Ghi lai MOI lan quet/kiem tra voucher (ca khi thanh cong lan that bai)
-- de tra soat, chong gian lan va debug khi doi tac bao loi.
-- Khac voi VOUCHER_SYNC (chi luu ban ghi thu hoi THANH CONG).
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'VoucherScanLogs' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.VoucherScanLogs (
        Id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
        UserId              INT NULL,
        UserName            NVARCHAR(100) NULL,
        LocationsGroup      NVARCHAR(100) NULL,
        LocationsDetail     NVARCHAR(100) NULL,
        VoucherCode         NVARCHAR(24)  NOT NULL,
        ScanMethod          NVARCHAR(20)  NOT NULL,   -- 'CAMERA' | 'HID_SCANNER' | 'MANUAL'
        Action              NVARCHAR(10)  NOT NULL,   -- 'CHECK' | 'REDEEM'
        ResultStatus        NVARCHAR(20)  NOT NULL,   -- 'UNUSED' | 'USED' | 'EXPIRED' | 'NOT_FOUND' | 'ERROR' | 'REDEEMED'
        ValueAmt            NUMERIC(18,2) NULL,
        VoucherExpiryDate   DATETIME NULL,
        VoucherIssueDate    DATETIME NULL,
        CoreApiHttpStatus   INT NULL,
        CoreApiMessage      NVARCHAR(1000) NULL,
        ClientIp            NVARCHAR(60) NULL,
        CreatedDate         DATETIME NOT NULL DEFAULT (GETDATE())
    );

    CREATE INDEX IX_VoucherScanLogs_VoucherCode ON dbo.VoucherScanLogs (VoucherCode);
    CREATE INDEX IX_VoucherScanLogs_CreatedDate ON dbo.VoucherScanLogs (CreatedDate);
    CREATE INDEX IX_VoucherScanLogs_LocationsDetail ON dbo.VoucherScanLogs (LocationsDetail);
END
GO
