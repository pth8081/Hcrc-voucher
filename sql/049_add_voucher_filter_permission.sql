-- =====================================================================
-- 049_add_voucher_filter_permission.sql
-- Theo yeu cau nguoi dung: them 1 man hinh RIENG, GON hon "Ket noi API" day
-- du, CHI cho sua loc ma voucher theo tien to (Loai tru/Chi chap nhan - xem
-- sql/047), ap dung duoc cho CA tai khoan Quan tri HCRC (role=1) LAN Quan
-- tri doi tac - nhung PHAI duoc cap quyen RIENG moi dung duoc, khong tu
-- dong co san cho ai (xem voucherCodeFilter.routes.js).
--
-- Khac voi 9 cot AdminCanXxx/PartnerAdminCanXxx cua sql/041 (DEFAULT 1, vi
-- la GIOI HAN BOT 1 nang luc da co san tu truoc - phai giu nguyen hanh vi
-- cu de khong ai mat quyen dot ngot), 2 cot nay la nang luc HOAN TOAN MOI
-- (truoc gio KHONG ai (ke ca Quan tri doi tac) sua duoc gi o day ca) nen
-- DEFAULT 0 - KHONG tu dong cap cho bat ky tai khoan nao, ke ca Quan tri
-- day du dang co san - HCRC phai chu dong tick cap tung tai khoan can dung.
-- =====================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'AdminCanManageVoucherFilter'
)
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD AdminCanManageVoucherFilter BIT NOT NULL CONSTRAINT DF_VAP_AdminCanManageVoucherFilter DEFAULT 0;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'PartnerAdminCanManageVoucherFilter'
)
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD PartnerAdminCanManageVoucherFilter BIT NOT NULL CONSTRAINT DF_VAP_PartnerAdminCanManageVoucherFilter DEFAULT 0;
END
GO
