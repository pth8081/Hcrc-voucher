-- =====================================================================
-- 032_create_schema_migrations.sql
-- Bang theo doi cac file migration DA AP DUNG (scripts/migrate.js ghi vao sau moi lan chay
-- thanh cong) - dung de app TU KIEM TRA schema CSDL co dung khop voi code dang chay hay khong
-- NGAY LUC KHOI DONG (xem src/utils/schemaCheck.js, goi tu src/server.js), truoc khi mo cong
-- HTTP nhan request that.
--
-- Boi canh: cac migration deu la cong bang MOI (vd sql/031 them PartnerAdminConnectionId), duoc
-- nhieu doan code GOI VO DIEU KIEN bat ke tai khoan co dung tinh nang moi do hay khong (vd
-- permissionService.js#getPermissions() chay o MOI lan quet/thu hoi cua MOI tai khoan nhan vien,
-- khong chi rieng tai khoan lien quan). Quen chay `npm run migrate` sau khi cap nhat code se lam
-- GIAN DOAN HOAN TOAN chuc nang do cho MOI tai khoan - khong phai 1 loi nho. Truoc ban nay, loi
-- do chi duoc phat hien khi co nguoi quet that bai that su (xem bao cao thuc te dan den ban nay).
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SchemaMigrations' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.SchemaMigrations (
        Filename    NVARCHAR(255) NOT NULL PRIMARY KEY,
        AppliedDate DATETIME NOT NULL DEFAULT (GETDATE())
    );
END
GO
