-- =====================================================================
-- 046_add_email_phone_contact.sql
-- Theo yeu cau nguoi dung: them Email/So dien thoai (deu TUY CHON) cho
-- tai khoan dang nhap cua app - dung de tich chon nhanh nguoi nhan o man
-- "Lich gui email bao cao" thay vi phai go tay tung dia chi email moi lan
-- tao lich. Them vao dbo.VoucherAppPermissions (bang app TU TAO, khong
-- phai dbo.Users goc cua he thong Core) - dung nguyen tac da ap dung
-- xuyen suot: KHONG BAO GIO sua cau truc bang Core, chi mo rong bang app
-- tu quan ly (giong CompanyId/IsPartnerAccount o sql/043).
-- =====================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'Email'
)
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD Email NVARCHAR(200) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'Phone'
)
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD Phone NVARCHAR(30) NULL;
END
GO
