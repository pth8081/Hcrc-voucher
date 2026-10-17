-- =====================================================================
-- 028_create_user_voucher_systems.sql
-- Bang app tu tao - gioi han 1 tai khoan CHI duoc quet/thu hoi (va mac dinh CHI xem bao cao)
-- theo 1 so HE THONG VOUCHER cu the (ApiConnections.Id, vd "BRGmart"/"Fuji").
--
-- Quy uoc: tai khoan KHONG co dong nao trong bang nay = KHONG GIOI HAN (duoc dung/xem TOAN BO
-- he thong hien co, dung hanh vi truoc khi co tinh nang nay - tranh moi tai khoan dang dung bi
-- khoa het ngay sau khi nang cap). Tai khoan CO it nhat 1 dong = CHI duoc dung/xem DUNG cac he
-- thong duoc liet ke o day, khong con duoc tu do chon he thong khac.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'UserVoucherSystems' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.UserVoucherSystems (
        UserId        INT NOT NULL,
        ConnectionId   INT NOT NULL,
        CreatedDate    DATETIME NOT NULL DEFAULT (GETDATE()),
        CONSTRAINT PK_UserVoucherSystems PRIMARY KEY (UserId, ConnectionId)
    );
END
GO
