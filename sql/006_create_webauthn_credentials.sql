-- =====================================================================
-- 006_create_webauthn_credentials.sql
-- Luu passkey (WebAuthn) dang ky tren tung thiet bi de dang nhap bang
-- van tay/Face ID. Mot user co the co NHIEU dong (nhieu thiet bi), va
-- 1 thiet bi dung chung tai quay co the luu passkey cua NHIEU user -
-- trinh duyet/he dieu hanh se tu hien bang chon tai khoan (discoverable
-- credential) khi dang nhap, khong can go ten dang nhap truoc.
-- Khong dung cham bang Users co san.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'WebAuthnCredentials' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.WebAuthnCredentials (
        Id                  INT IDENTITY(1,1) PRIMARY KEY,
        UserId              INT NOT NULL,
        CredentialId        NVARCHAR(400) NOT NULL,   -- base64url, ID duy nhat cua passkey
        PublicKey           NVARCHAR(MAX) NOT NULL,   -- COSE public key, luu dang base64
        Counter             BIGINT NOT NULL DEFAULT (0),
        DeviceType          NVARCHAR(20) NULL,        -- 'singleDevice' | 'multiDevice' (tu simplewebauthn)
        Backed_Up           BIT NOT NULL DEFAULT (0),
        DeviceLabel         NVARCHAR(200) NULL,       -- ten goi nho de nhan biet (vd: "Tablet quay 1")
        Transports          NVARCHAR(200) NULL,       -- JSON array vd ["internal"]
        CreatedDate         DATETIME NOT NULL DEFAULT (GETDATE()),
        LastUsedDate        DATETIME NULL,
        CONSTRAINT UQ_WebAuthnCredentials_CredentialId UNIQUE (CredentialId),
        CONSTRAINT FK_WebAuthnCredentials_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserID)
    );

    CREATE INDEX IX_WebAuthnCredentials_UserId ON dbo.WebAuthnCredentials (UserId);
END
GO
