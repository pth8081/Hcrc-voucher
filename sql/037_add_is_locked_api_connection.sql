-- =====================================================================
-- 037_add_is_locked_api_connection.sql
-- Them co "khoa" cho 1 ket noi Core API (bang ApiConnections) - cho phep
-- admin tam vo hieu hoa 1 ket noi (khong xoa) ma khong anh huong ket noi
-- khac. Khac IsActive (chi 1 ket noi active tai 1 thoi diem, quyet dinh
-- ket noi MAC DINH): IsLocked ap dung DOC LAP tren TUNG ket noi, 1 ket
-- noi bi khoa thi KHONG the dung (du la active hay duoc chon rieng qua
-- connectionId) cho den khi duoc mo khoa lai - xem apiConnectionService.js,
-- coreVoucherService.js#resolveConnection.
-- =====================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.ApiConnections') AND name = 'IsLocked'
)
BEGIN
    ALTER TABLE dbo.ApiConnections ADD IsLocked BIT NOT NULL DEFAULT (0);
END
GO
