-- =====================================================================
-- 014_create_voucher_app_permissions.sql
-- Quyen theo TUNG TINH NANG cua app nay - tach hoan toan khoi bang Users
-- co san (dung chung voi he thong khac) va khac voi bang UserPermissions
-- da co san trong schema goc (thuoc he thong khac, khong dung o day) -
-- dat ten VoucherAppPermissions de tranh nham lan voi bang do.
--
-- Chi ap dung cho tai khoan NHAN VIEN (Users.status = 0). Tai khoan QUAN
-- TRI (status = 1) LUON co du 4 quyen ben duoi, khong can dong nao trong
-- bang nay - xem middleware/requireFeature.js.
--
-- Khong dat FOREIGN KEY toi Users(UserID): cung ly do da giai thich o
-- 001_create_redemption_units.sql (mot so DB that, Users.UserID tuy la
-- IDENTITY nhung khong chac da co PRIMARY KEY/UNIQUE).
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'VoucherAppPermissions' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.VoucherAppPermissions (
        UserId                  INT NOT NULL PRIMARY KEY,
        CanRedeemVoucher        BIT NOT NULL DEFAULT (1),  -- quet/thu hoi voucher
        CanViewReconciliation   BIT NOT NULL DEFAULT (1),  -- bao cao doi soat theo ngay
        CanViewSummary          BIT NOT NULL DEFAULT (0),  -- bao cao tong hop theo khoang ngay
        CanViewUsedVouchers     BIT NOT NULL DEFAULT (0),  -- danh sach voucher da su dung + xuat Excel
        UpdatedBy               NVARCHAR(100) NULL,
        UpdatedDate             DATETIME NULL
    );
END
GO
