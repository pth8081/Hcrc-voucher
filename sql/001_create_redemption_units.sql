-- =====================================================================
-- 001_create_redemption_units.sql
-- Bo sung thong tin nghiep vu cho "don vi thu hoi voucher" (doi tac).
-- Khong sua bang Locations_Detail hien co, chi mo rong 1-1 theo id
-- de tranh anh huong cac he thong dang dung Locations_Group/Locations_Detail.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RedemptionUnits' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.RedemptionUnits (
        Id                  INT IDENTITY(1,1) PRIMARY KEY,
        LocationDetailId    INT NOT NULL,                 -- FK -> Locations_Detail.id
        PartnerCode         NVARCHAR(50)  NOT NULL,
        PartnerName         NVARCHAR(300) NOT NULL,
        ContactName         NVARCHAR(200) NULL,
        ContactPhone        NVARCHAR(40)  NULL,
        ContactEmail        NVARCHAR(200) NULL,
        Address             NVARCHAR(500) NULL,
        TaxCode             NVARCHAR(50)  NULL,
        BankAccount         NVARCHAR(100) NULL,
        BankName            NVARCHAR(200) NULL,
        DailyLimitAmount    NUMERIC(18,2) NULL,           -- han muc thu hoi/ngay (tuy chon)
        Status              BIT NOT NULL DEFAULT (1),      -- 1 = active, 0 = ngung hop tac
        CreatedDate         DATETIME NOT NULL DEFAULT (GETDATE()),
        UpdatedDate         DATETIME NULL,
        CONSTRAINT UQ_RedemptionUnits_LocationDetailId UNIQUE (LocationDetailId),
        CONSTRAINT UQ_RedemptionUnits_PartnerCode UNIQUE (PartnerCode),
        CONSTRAINT FK_RedemptionUnits_LocationsDetail FOREIGN KEY (LocationDetailId)
            REFERENCES dbo.Locations_Detail (id)
    );
END
GO
