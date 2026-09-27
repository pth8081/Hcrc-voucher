-- =====================================================================
-- 021_add_guide_permissions.sql
-- Them 2 quyen tinh nang moi vao dbo.VoucherAppPermissions (bang da co tu migration 014,
-- ALTER them cot - khong tao bang moi/khong dung bang legacy) cho module "Huong dan" moi trong
-- app: mot ban huong dan NGHIEP VU (cach quet/thu hoi/doc bao cao - danh cho nhan vien) va mot
-- ban huong dan HE THONG (cach cau hinh ket noi Core API/quan ly tai khoan - danh cho quan tri/
-- nguoi phu trach ky thuat). Tach rieng 2 quyen (thay vi 1 quyen "xem huong dan" chung) de admin
-- co the cap rieng cho nhan vien nao can biet ca phan cau hinh he thong (vd nhan vien duoc dao
-- tao lam quan tri phu) ma khong can nang len tai khoan quan tri day du.
--
-- Mac dinh: CanViewBusinessGuide = 1 (nghiep vu - huu ich cho hau het nhan vien tu dau),
-- CanViewSystemGuide = 0 (he thong - chi nen bat rieng khi can, giong triet ly cua
-- CanViewSummary/CanViewUsedVouchers da co).
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'CanViewBusinessGuide')
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD CanViewBusinessGuide BIT NOT NULL DEFAULT (1);
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'CanViewSystemGuide')
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD CanViewSystemGuide BIT NOT NULL DEFAULT (0);
END
GO
