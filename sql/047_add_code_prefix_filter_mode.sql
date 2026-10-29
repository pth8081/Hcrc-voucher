-- =====================================================================
-- 047_add_code_prefix_filter_mode.sql
-- Theo yeu cau nguoi dung: ben canh danh sach LOAI TRU (blacklist) da co tu
-- 030_add_excluded_code_prefixes.sql, them 1 danh sach CHAP NHAN (whitelist)
-- tien to ma voucher - neu dung, CHI ma bat dau DUNG 1 trong cac tien to
-- liet ke moi duoc quet/thu hoi, con lai bi tu choi (nguoc lai hoan toan voi
-- blacklist). 2 danh sach nay LOAI TRU NHAU (chi 1 co hieu luc tai 1 thoi
-- diem) - CodePrefixFilterMode quyet dinh dang dung 'EXCLUDE' (mac dinh, giu
-- nguyen hanh vi cu cho moi ket noi da co) hay 'INCLUDE'. Xem logic ap dung
-- o voucherService.js#checkPrefixFilter.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ApiConnections') AND name = 'AllowedCodePrefixes')
BEGIN
    ALTER TABLE dbo.ApiConnections ADD AllowedCodePrefixes NVARCHAR(500) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ApiConnections') AND name = 'CodePrefixFilterMode')
BEGIN
    ALTER TABLE dbo.ApiConnections ADD CodePrefixFilterMode NVARCHAR(10) NOT NULL DEFAULT ('EXCLUDE');
END
GO
