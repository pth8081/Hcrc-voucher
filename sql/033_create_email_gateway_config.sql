-- =====================================================================
-- 033_create_email_gateway_config.sql
-- Cau hinh may chu gui email (SMTP) DUNG CHUNG cho toan he thong - CHI 1 dong duy nhat (khong
-- can ID rieng cho tung doi tac/nguoi dung), vi hien tai chi ho tro 1 may chu gui thu. Day la ha
-- tang dung chung (vd IP noi bo, mat khau tai khoan gui mail that) nen CHI quan tri DAY DU moi
-- duoc xem/sua - xem middleware/requireRole.js#requireAdmin, src/routes/emailGateway.routes.js.
--
-- PasswordEncrypted ma hoa AES-256-GCM bang CUNG 1 co che voi ApiConnections.AuthTokenEncrypted
-- (xem src/utils/crypto.js) - dung chung ENCRYPTION_KEY, khong them bien moi truong rieng.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EmailGatewayConfig' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.EmailGatewayConfig (
        Id                  INT NOT NULL PRIMARY KEY IDENTITY(1,1),
        Host                NVARCHAR(255) NOT NULL,
        Port                INT NOT NULL,
        Secure              BIT NOT NULL DEFAULT (0),   -- TLS ngay tu dau ket noi (vd cong 465)
        RejectUnauthorized  BIT NOT NULL DEFAULT (1),   -- 0 = bo qua kiem tra chung chi TLS (may chu SMTP noi bo dung chung chi tu ky)
        Username            NVARCHAR(255) NULL,
        PasswordEncrypted   NVARCHAR(MAX) NULL,
        FromEmail           NVARCHAR(255) NOT NULL,
        FromName            NVARCHAR(200) NULL,
        UpdatedBy           NVARCHAR(100) NULL,
        UpdatedDate         DATETIME NULL
    );
END
GO
