-- =====================================================================
-- 020_drop_partner_api_keys.sql
-- Dot ra soat sau phat hien: bang PartnerApiKeys (migration 019) va tinh nang di kem
-- (/api/v1/vouchers/*, man hinh "API doi tac") da bi xay SAI CHIEU - hieu nham tai lieu doi tac
-- cung cap thanh "minh cap key cho ben khac goi vao app", trong khi thuc te la NGUOC LAI: doi
-- tac cap 1 key de CHINH APP NAY dung khi GOI RA Core Voucher API cua ho (cau hinh qua man hinh
-- "Ket noi API" da co san tu truoc, xem apiConnectionService.js/dynamicCoreApiClient.js - khong
-- can them bang/API/man hinh moi nao). Migration nay xoa sach bang da tao nham (an toan chay du
-- migration 019 da tung ap dung hay chua, dung IF EXISTS).
-- =====================================================================
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PartnerApiKeys' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    DROP TABLE dbo.PartnerApiKeys;
END
GO
