-- =====================================================================
-- 012_create_user_password_policy.sql
-- Bat buoc DOI MAT KHAU trong LAN DANG NHAP DAU TIEN vao ung dung nay (ap dung cho MOI tai
-- khoan - ca quan tri lan nhan vien) MA KHONG sua bang dbo.Users co san. Tai khoan CHUA CO
-- dong trong bang nay (chua tung doi mat khau qua app nay) mac dinh coi la BAT BUOC doi
-- (xem passwordPolicyService.js#mustChangePassword) - khong can seed du lieu cho tai khoan cu.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'UserPasswordPolicy' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.UserPasswordPolicy (
        UserId              INT NOT NULL PRIMARY KEY,
        MustChangePassword  BIT NOT NULL DEFAULT (1),
        PasswordChangedDate DATETIME NULL,
        UpdatedDate         DATETIME NOT NULL DEFAULT (GETDATE()),
        CONSTRAINT FK_UserPasswordPolicy_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserID)
    );
END
GO
