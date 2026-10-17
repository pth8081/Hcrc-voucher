-- =====================================================================
-- 026_add_connection_to_scan_logs.sql
-- Them ConnectionName vao dbo.VoucherScanLogs (bang app tu tao, KHONG phai bang legacy) - ghi
-- lai HE THONG VOUCHER nao (ten ket noi trong ApiConnections, vd "BRGmart"/"Fuji") da xu ly moi
-- lan quet/thu hoi, phuc vu truy vet khi co nhieu he thong voucher cung duoc tich hop.
--
-- Chi ghi TEN (khong phai FK toi ApiConnections.Id) - don gian, khong can JOIN de doc log, va
-- van giu dung ten da dung tai thoi diem quet ke ca sau nay ket noi do bi doi ten/xoa.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.VoucherScanLogs') AND name = 'ConnectionName')
BEGIN
    ALTER TABLE dbo.VoucherScanLogs ADD ConnectionName NVARCHAR(100) NULL;
END
GO
