-- =====================================================================
-- 013_create_webauthn_challenges.sql
-- Luu TAM challenge WebAuthn (dang ky/dang nhap van tay-Face ID) giua 2 buoc "lay challenge"
-- va "xac minh phan hoi tu thiet bi". Truoc day luu trong bo nho (Map) cua 1 tien trinh - KHONG
-- dung duoc khi chay nhieu worker (CLUSTER_WORKERS > 1, xem README muc 3): 2 buoc co the roi
-- vao 2 tien trinh khac nhau, lam dang nhap van tay bao "het han" NGAU NHIEN du con trong TTL.
-- Chuyen sang luu tam trong DB de dung chung duoc giua moi worker/tien trinh.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'WebAuthnChallenges' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.WebAuthnChallenges (
        FlowId      CHAR(32) NOT NULL PRIMARY KEY,   -- 16 byte ngau nhien dang hex, dung 1 lan
        Challenge   NVARCHAR(500) NOT NULL,
        UserId      INT NULL,                        -- NULL luc dang nhap (chua biet truoc ai)
        ExpiresAt   DATETIME NOT NULL,
        CreatedDate DATETIME NOT NULL DEFAULT (GETDATE())
    );
END
GO
