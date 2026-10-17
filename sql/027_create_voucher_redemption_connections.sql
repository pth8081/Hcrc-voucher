-- =====================================================================
-- 027_create_voucher_redemption_connections.sql
-- Bang app tu tao (KHONG phai bang legacy) - ghi lai HE THONG VOUCHER (ApiConnections.Id/Name)
-- da xu ly 1 giao dich thu hoi, khoa theo TRANS_NUM (giong khoa tu nhien cua VOUCHER_SYNC).
--
-- Ly do can bang nay: khi 1 giao dich thu hoi KHONG goi duoc Core luc do (mat mang...), VOUCHER_
-- SYNC van ghi ngay voi Sync='N' ("cho dong bo"), va job nen syncRetryService.js se tu dong goi
-- lai Core SAU DO de dong bo. VOUCHER_SYNC (bang dung chung voi Core, KHONG duoc sua cau truc)
-- khong co cot nao luu "giao dich nay thuoc he thong nao" - neu khong co bang nay, job dong bo
-- lai se KHONG BIET phai goi lai dung he thong nao (vd 1 giao dich Fuji dang cho dong bo co the
-- bi goi lai nham sang BRGmart neu do dang la ket noi "active" luc job chay), day la loi nghiep
-- vu nghiem trong (gui sai he thong).
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'VoucherRedemptionConnections' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.VoucherRedemptionConnections (
        TransNum        CHAR(18) NOT NULL PRIMARY KEY,  -- = VOUCHER_SYNC.TRANS_NUM cua giao dich
        ConnectionId     INT NULL,                        -- ApiConnections.Id (NULL neu dung fallback .env cu)
        ConnectionName   NVARCHAR(100) NULL,
        CreatedDate      DATETIME NOT NULL DEFAULT (GETDATE())
    );
END
GO
