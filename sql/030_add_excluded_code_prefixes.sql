-- =====================================================================
-- 030_add_excluded_code_prefixes.sql
-- Cho phep tung ket noi Core API (Fuji/HCRC...) khai bao 1 danh sach tien
-- to ma voucher BI LOAI TRU - mac voucherCode BAT DAU DUNG (so khop CHINH
-- XAC tung ky tu, khong phai gan dung) 1 trong cac tien to nay se bi tu
-- choi NGAY luc quet/thu hoi, KHONG goi sang Core (xem voucherService.js).
-- Luu dang 1 chuoi, cac tien to cach nhau boi dau phay (vd "C, TEST, X9").
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ApiConnections') AND name = 'ExcludedCodePrefixes')
BEGIN
    ALTER TABLE dbo.ApiConnections ADD ExcludedCodePrefixes NVARCHAR(500) NULL;
END
GO
