-- =====================================================================
-- 039_create_voucher_redemption_invoices.sql
-- Bang app tu tao (KHONG phai bang legacy) - ghi lai SO HOA DON (do nhan vien tu go, thuoc ve
-- he thong ban hang RIENG cua doi tac, khong lien quan/khong dong bo gi voi app nay) cho 1 LUOT
-- xac nhan thu hoi, khoa theo TRANS_NUM (giong khoa tu nhien cua VOUCHER_SYNC va cach lam cua
-- VoucherRedemptionConnections o tren). VOUCHER_SYNC (bang dung chung voi Core, KHONG duoc sua
-- cau truc) khong co cho de luu thong tin nay.
--
-- 1 LUOT xac nhan co the gom NHIEU voucher (quet nhieu, xem muc 18 README) nhung CHI 1 so hoa
-- don duy nhat cho ca luot do (1 khach thanh toan gop nhieu voucher = 1 hoa don) - nen moi
-- TRANS_NUM (1 dong rieng cho TUNG voucher trong VOUCHER_SYNC) trong CUNG 1 luot se co CUNG 1
-- InvoiceNumber, ghi lap lai tung dong thay vi 1 bang nhom rieng - don gian hoa truy van bao cao
-- (JOIN truc tiep theo TransNum, khong can thao tac GROUP BY nao them).
--
-- Hoan toan TUY CHON: khong dien so hoa don van thu hoi binh thuong, khong co dong nao duoc tao
-- o day cho giao dich do (JOIN LEFT o cac truy van bao cao se tra ve NULL/trong).
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'VoucherRedemptionInvoices' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.VoucherRedemptionInvoices (
        TransNum        CHAR(18) NOT NULL PRIMARY KEY,  -- = VOUCHER_SYNC.TRANS_NUM cua giao dich
        InvoiceNumber   NVARCHAR(50) NOT NULL,
        CreatedDate     DATETIME NOT NULL DEFAULT (GETDATE())
    );
    CREATE INDEX IX_VoucherRedemptionInvoices_InvoiceNumber ON dbo.VoucherRedemptionInvoices (InvoiceNumber);
END
GO
