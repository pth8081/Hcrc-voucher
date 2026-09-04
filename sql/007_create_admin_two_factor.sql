-- =====================================================================
-- 007_create_admin_two_factor.sql
-- Xac thuc hai yeu to (TOTP) BAT BUOC cho tai khoan quan tri (Users.status = 1).
-- Chi luu secret TOTP da MA HOA (AES-256-GCM, cung khoa ENCRYPTION_KEY dang dung
-- cho ApiConnections) - khong luu ma OTP hay anh QR. Mot admin KHAC co the go
-- (reset) 2FA cua mot admin bi mat thiet bi - xem twoFactorService.adminResetOther.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AdminTwoFactor' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.AdminTwoFactor (
        Id                  INT IDENTITY(1,1) PRIMARY KEY,
        UserId              INT NOT NULL,
        SecretEncrypted     NVARCHAR(500) NOT NULL,
        Enabled             BIT NOT NULL DEFAULT (0),   -- 0 = da tao secret nhung CHUA xac minh xong buoc thiet lap
        CreatedDate         DATETIME NOT NULL DEFAULT (GETDATE()),
        EnabledDate         DATETIME NULL,
        LastUsedDate        DATETIME NULL,
        ResetByUsername     NVARCHAR(100) NULL,          -- ten dang nhap cua admin KHAC da go 2FA nay (neu co)
        ResetDate           DATETIME NULL,
        CONSTRAINT UQ_AdminTwoFactor_UserId UNIQUE (UserId),
        CONSTRAINT FK_AdminTwoFactor_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserID)
    );
    CREATE INDEX IX_AdminTwoFactor_UserId ON dbo.AdminTwoFactor (UserId);
END
GO
