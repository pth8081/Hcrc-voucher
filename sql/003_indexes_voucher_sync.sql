-- =====================================================================
-- 003_indexes_voucher_sync.sql
-- Index ho tro tra cuu nhanh khi kiem tra trung / doi soat hang ngay
-- tren bang VOUCHER_SYNC san co. Chi tao index, KHONG doi cau truc bang.
-- =====================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_VOUCHER_SYNC_Voucher_Code' AND object_id = OBJECT_ID('dbo.VOUCHER_SYNC')
)
BEGIN
    CREATE INDEX IX_VOUCHER_SYNC_Voucher_Code ON dbo.VOUCHER_SYNC (Voucher_Code);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_VOUCHER_SYNC_Created_Date' AND object_id = OBJECT_ID('dbo.VOUCHER_SYNC')
)
BEGIN
    CREATE INDEX IX_VOUCHER_SYNC_Created_Date ON dbo.VOUCHER_SYNC (Created_Date);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_VOUCHER_SYNC_Locations_Detail' AND object_id = OBJECT_ID('dbo.VOUCHER_SYNC')
)
BEGIN
    CREATE INDEX IX_VOUCHER_SYNC_Locations_Detail ON dbo.VOUCHER_SYNC (Locations_Detail);
END
GO
