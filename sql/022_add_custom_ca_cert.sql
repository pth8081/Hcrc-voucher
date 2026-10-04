-- =====================================================================
-- 022_add_custom_ca_cert.sql
-- Cho phep tung ket noi Core API khai bao THEM 1 chung chi CA cong khai
-- (PEM) de tin tuong, danh cho truong hop doi tac dung chung chi tu ky
-- hoac CA noi bo (khong nam trong kho CA cong khai chuan cua Node.js).
-- Day la du lieu CONG KHAI (khong phai bi mat/private key) nen khong ma
-- hoa nhu AuthTokenEncrypted/BasicPasswordEncrypted o tren.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ApiConnections') AND name = 'CustomCaCert')
BEGIN
    ALTER TABLE dbo.ApiConnections ADD CustomCaCert NVARCHAR(MAX) NULL;
END
GO
