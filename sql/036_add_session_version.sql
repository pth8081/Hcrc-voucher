-- =====================================================================
-- 036_add_session_version.sql
-- Them SessionVersion (so nguyen, tang don gian +1 moi lan dang nhap/cap phien THANH CONG)
-- vao dbo.UserPasswordPolicy (bang da co tu migration 012/025, cung quy uoc voi
-- PasswordVersion o migration 025 - 1 "bo dem" so nguyen de vo hieu hoa token cu, khong phu
-- thuoc dong ho may nao) - phuc vu BAT BUOC MOI TAI KHOAN CHI CO DUNG 1 PHIEN DANG NHAP HOAT
-- DONG TAI 1 THOI DIEM (dang nhap o thiet bi/trinh duyet moi se tu dong lam MAT HIEU LUC NGAY
-- phien dang nhap cu, khong can cho het han 8 tieng mac dinh).
--
-- Co che: moi lan cap phien day du (authService.js#issueSession - goi sau khi dang nhap mat
-- khau/van tay thanh cong, hoac sau khi xac minh 2FA xong) deu TANG so nay len 1 va "nhung"
-- gia tri MOI vao JWT luc cap. middleware/auth.js doi chieu gia tri trong token voi gia tri
-- HIEN TAI trong CSDL (qua cache TTL ngan co san, sessionRevalidation.js) - CHI token mang
-- DUNG gia tri MOI NHAT moi con hop le, token nao mang gia tri CU (da bi 1 lan dang nhap sau do
-- "vuot qua") se bi tu choi ngay o lan goi API tiep theo.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.UserPasswordPolicy') AND name = 'SessionVersion')
BEGIN
    ALTER TABLE dbo.UserPasswordPolicy ADD SessionVersion INT NOT NULL DEFAULT (1);
END
GO
