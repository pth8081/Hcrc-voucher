-- =====================================================================
-- 031_add_partner_admin_connection.sql
-- Them 1 cot moi vao dbo.VoucherAppPermissions (bang da co tu migration 014, ALTER them cot -
-- khong tao bang moi/khong dung bang legacy) de danh dau 1 tai khoan NHAN VIEN (Users.status = 0)
-- la "quan tri gioi han theo 1 he thong voucher cu the" (vd cap cho doi tac Fuji 1 tai khoan tu
-- xem/quan ly cac tai khoan CHI dung Fuji cua chinh ho, ma KHONG thay duoc tai khoan quan tri
-- HCRC hay tai khoan cua doi tac khac).
--
-- NULL (mac dinh) = tai khoan thuong, khong co quyen nay. Co gia tri = Id cua 1
-- dbo.ApiConnections (he thong voucher ma tai khoan nay duoc quan tri gioi han) - xem
-- middleware/requirePartnerAdmin.js va src/services/partnerAdminService.js.
--
-- Khong dat FOREIGN KEY toi ApiConnections.Id: cung quy uoc da dung o
-- 028_create_user_voucher_systems.sql (ConnectionId cua bang do cung khong co FK) - de nhat quan,
-- va tranh loi xoa 1 ket noi dang duoc gan lam partner-admin cho ai do (ra soat sau se tu loc bo
-- tai cac noi doc du lieu nay neu ket noi da bi xoa).
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'PartnerAdminConnectionId')
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD PartnerAdminConnectionId INT NULL;
END
GO
