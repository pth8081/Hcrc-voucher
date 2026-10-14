-- =====================================================================
-- 025_add_password_version.sql
-- Them PasswordVersion (so nguyen, tang don gian +1 moi lan doi/dat lai mat khau) vao
-- dbo.UserPasswordPolicy - thay the co che vo hieu hoa token cu dua tren SO SANH DONG HO
-- (JWT "iat" cap boi may chu Node vs PasswordChangedDate ghi boi GETDATE() cua SQL Server,
-- xem middleware/auth.js) bang SO SANH SO NGUYEN, khong phu thuoc dong ho may nao ca.
--
-- Loi da phat hien that qua bao cao nguoi dung: neu dong ho SQL Server nhanh hon may chu Node
-- tu 10 giay tro len (lech dong ho giua 2 may, pho bien khi khong dong bo NTP), MOI token vua
-- cap NGAY SAU KHI doi mat khau (vd luong bat buoc doi mat khau lan dau -> 2FA -> cap phien day
-- du) bi coi NHAM la cap TRUOC lan doi mat khau, bi tu choi ngay lap tuc - tai khoan vua dang
-- nhap xong bi dang xuat lien tuc, khong the nao vao duoc.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.UserPasswordPolicy') AND name = 'PasswordVersion')
BEGIN
    ALTER TABLE dbo.UserPasswordPolicy ADD PasswordVersion INT NOT NULL DEFAULT (1);
END
GO
