-- =====================================================================
-- 048_add_expiry_date_voucher_redemption_connections.sql
-- Theo yeu cau nguoi dung: them cot "Thoi han" (han su dung voucher, tu Core
-- tra ve luc kiem tra truoc khi thu hoi) vao ca 3 man hinh bao cao (Doi soat/
-- Tong hop/Da su dung) va file Excel/email dinh kem tuong ung.
--
-- VOUCHER_SYNC (bang legacy dung chung voi Core, KHONG duoc sua cau truc)
-- khong co cot nao luu han su dung ca - them vao bang app tu tao
-- VoucherRedemptionConnections (sql/027, da khoa san theo TRANS_NUM va da
-- duoc JOIN san vao ca 3 truy van bao cao) thay vi tao them 1 bang/JOIN
-- moi. Ghi tai voucherService.js#redeemAndInsertGuarded, lay tu ket qua
-- kiem tra Core NGAY TRUOC luc thu hoi (precheck.expiryDate).
--
-- Luu y: cot nay duoc ghi TRUC TIEP tu 1 Date object JS (khong qua ham
-- GETDATE() cua SQL Server nhu Created_Date), nen KHONG gap loi lech 7
-- tieng kieu v3.89/v3.99 - khong can DATEADD(HOUR, -7, ...) khi doc lai.
-- Ban ghi CU (truoc migration nay) se co ExpiryDate = NULL, hien "-" tren
-- bao cao - giong het cach ConnectionId/ConnectionName da xu ly cho du
-- lieu cu truoc sql/027.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.VoucherRedemptionConnections') AND name = 'ExpiryDate')
BEGIN
    ALTER TABLE dbo.VoucherRedemptionConnections ADD ExpiryDate DATETIME NULL;
END
GO
