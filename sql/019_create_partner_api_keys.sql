-- =====================================================================
-- 019_create_partner_api_keys.sql
-- API key cho doi tac tich hop truc tiep (khong qua UI web/JWT) - dung cho
-- endpoint /api/v1/vouchers/check va /redeem (xem partnerVoucher.routes.js).
-- Moi key GAN VOI 1 TAI KHOAN NHAN VIEN CO SAN (khong phai quan tri - xem rang
-- buoc o partnerApiKeyService.js): khi goi API bang key, he thong dung DUNG
-- Locations_Group/Locations_Detail/Username cua tai khoan do, y het tai khoan
-- do tu dang nhap goi API - tai dung toan bo logic phan quyen/ghi nhat ky/doi
-- soat dang co, khong can doi schema nghiep vu (VOUCHER_SYNC...).
-- Chi luu HASH (SHA-256) cua key, khong bao gio luu ban ro - giong nguyen tac
-- luu mat khau (Users.Password), nhung dung hash nhanh (khong bcrypt) vi day la
-- 1 chuoi ngau nhien entropy cao (32 byte) chu khong phai mat khau nguoi go,
-- khong co nguy co do/brute-force o toc do nguoi dung.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PartnerApiKeys' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.PartnerApiKeys (
        Id                  INT IDENTITY(1,1) PRIMARY KEY,
        UserId              INT NOT NULL,
        Label               NVARCHAR(200) NOT NULL,      -- vd "Doi tac ABC - diem tieu Q1"
        KeyPrefix           NVARCHAR(20) NOT NULL,        -- vai ky tu dau (KHONG bi mat) de nhan dien trong danh sach
        KeyHash             NVARCHAR(64) NOT NULL,        -- SHA-256 hex (64 ky tu) cua key that
        CanCheck            BIT NOT NULL DEFAULT (1),     -- duoc phep goi /check
        CanRedeem           BIT NOT NULL DEFAULT (1),     -- duoc phep goi /redeem
        CreatedDate         DATETIME NOT NULL DEFAULT (GETDATE()),
        CreatedByUsername   NVARCHAR(100) NOT NULL,
        LastUsedDate        DATETIME NULL,
        RevokedDate         DATETIME NULL,                -- NULL = con hieu luc; da dat = bi thu hoi (khong xoa, giu vet)
        RevokedByUsername   NVARCHAR(100) NULL,
        CONSTRAINT UQ_PartnerApiKeys_KeyHash UNIQUE (KeyHash),
        CONSTRAINT FK_PartnerApiKeys_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserID)
    );

    CREATE INDEX IX_PartnerApiKeys_UserId ON dbo.PartnerApiKeys (UserId);
END
GO
