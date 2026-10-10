-- =====================================================================
-- 024_rename_api_server_connection.sql
-- Sua ten dong ket noi mau tao o migration 023 - ten dung phai la "HCRC
-- Voucher API Server" (ten cu "API Server - HCRC Report" la dat nham).
-- Dung UPDATE (doi ten TAI CHO) thay vi xoa/them lai, de khong mat Base
-- URL/API Key neu admin da tung dien vao dong nay truoc khi ban vá nay
-- duoc trien khai. An toan chay lai nhieu lan - khong con dong ten cu
-- thi khong lam gi ca.
-- =====================================================================
UPDATE dbo.ApiConnections
SET Name = N'HCRC Voucher API Server'
WHERE Name = N'API Server - HCRC Report';
GO
