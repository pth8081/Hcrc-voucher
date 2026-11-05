-- =====================================================================
-- 052_add_core_reconciliation.sql
-- "Doi soat cheo Core": doi voi tung voucher DA THU HOI tren he thong nay, goi lai API
-- "Kiem tra" cua Core de xac nhan Core/DSMart co THAT SU ghi nhan da su dung hay khong -
-- phat hien truong hop he thong nay bao thu hoi thanh cong nhung Core chua/khong ghi nhan.
-- Chi quyen quan tri (ca HCRC va Quan tri doi tac), phai duoc cap quyen rieng moi dung duoc
-- (mac dinh TAT ca 2 - xem permissionService.js).
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'AdminCanReconcileCore')
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD AdminCanReconcileCore BIT NOT NULL DEFAULT 0;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'PartnerAdminCanReconcileCore')
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD PartnerAdminCanReconcileCore BIT NOT NULL DEFAULT 0;
END
GO

-- 1 lan doi soat ("lan chay") - luu lai pham vi da chon + tong hop ket qua de hien "Lich su cac
-- lan doi soat gan day" va cho phep xem lai/xuat Excel sau nay. ConnectionId = NULL nghia la
-- pham vi "tat ca he thong" (chi Quan tri HCRC moi chon duoc) - Quan tri doi tac luon bi ep ve
-- DUNG 1 ConnectionId cua ho (xem coreReconciliationService.js#resolveScope).
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CoreReconciliationRuns')
BEGIN
    CREATE TABLE dbo.CoreReconciliationRuns (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CreatedByUserId INT NOT NULL,
        CreatedByUsername NVARCHAR(100) NOT NULL,
        CreatedDate DATETIME2 NOT NULL DEFAULT GETDATE(),
        ConnectionId INT NULL,
        CompanyId INT NULL,
        CompanyName NVARCHAR(200) NULL,
        -- Mo ta pham vi de hien thi TRUC TIEP o cot "Pham vi" cua bang lich su (vd "Tat ca cong ty"/
        -- "Fuji Mart - Chi nhanh Ha Noi") - khong can dung lai ConnectionId/CompanyId de suy luan lai.
        ScopeLabel NVARCHAR(300) NULL,
        FromDate DATE NOT NULL,
        ToDate DATE NOT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'RUNNING',
        TotalCount INT NOT NULL DEFAULT 0,
        CheckedCount INT NOT NULL DEFAULT 0,
        MatchCount INT NOT NULL DEFAULT 0,
        MismatchCount INT NOT NULL DEFAULT 0,
        ErrorMessage NVARCHAR(500) NULL,
        FinishedDate DATETIME2 NULL
    );
END
GO

-- Chi tiet tung voucher cua 1 lan doi soat - chi ghi SAU KHI da goi Core xong (khong ghi dan
-- trong luc chay, tranh ghi DB lien tuc) - CheckedCount tren bang Runs la nguon DUY NHAT cho
-- tien trinh dang chay (UI poll bang nay), ket qua chi tiet chi doc duoc khi Status <> RUNNING.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CoreReconciliationResults')
BEGIN
    CREATE TABLE dbo.CoreReconciliationResults (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        RunId INT NOT NULL,
        VoucherCode NVARCHAR(50) NOT NULL,
        TransNum NVARCHAR(50) NULL,
        CompanyName NVARCHAR(200) NULL,
        PointName NVARCHAR(200) NULL,
        RedeemedByUserName NVARCHAR(100) NULL,
        RedeemedDate DATETIME2 NULL,
        CoreStatus NVARCHAR(30) NULL,
        CoreMessage NVARCHAR(500) NULL,
        MatchResult NVARCHAR(10) NOT NULL,
        CONSTRAINT FK_CoreReconciliationResults_Run FOREIGN KEY (RunId) REFERENCES dbo.CoreReconciliationRuns(Id)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_CoreReconciliationResults_RunId' AND object_id = OBJECT_ID('dbo.CoreReconciliationResults')
)
BEGIN
    CREATE INDEX IX_CoreReconciliationResults_RunId ON dbo.CoreReconciliationResults (RunId);
END
GO
