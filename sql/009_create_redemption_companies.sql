-- =====================================================================
-- 009_create_redemption_companies.sql
-- "Cong ty" (doi tac cap tren) - 1 cong ty co the gan NHIEU diem tieu (RedemptionUnits) -
-- xem 010_add_company_to_redemption_units.sql. Thong tin lien he/thue/ngan hang chung cua
-- ca cong ty nam o day, tach khoi tung diem tieu rieng le.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RedemptionCompanies' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.RedemptionCompanies (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        CompanyCode     NVARCHAR(50)  NOT NULL,
        CompanyName     NVARCHAR(300) NOT NULL,
        ContactName     NVARCHAR(200) NULL,
        ContactPhone    NVARCHAR(40)  NULL,
        ContactEmail    NVARCHAR(200) NULL,
        Address         NVARCHAR(500) NULL,
        TaxCode         NVARCHAR(50)  NULL,
        BankAccount     NVARCHAR(100) NULL,
        BankName        NVARCHAR(200) NULL,
        Status          BIT NOT NULL DEFAULT (1),
        CreatedDate     DATETIME NOT NULL DEFAULT (GETDATE()),
        UpdatedDate     DATETIME NULL,
        CONSTRAINT UQ_RedemptionCompanies_CompanyCode UNIQUE (CompanyCode)
    );
END
GO
