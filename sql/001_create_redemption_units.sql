-- =====================================================================
-- 001_create_redemption_units.sql
-- Bo sung thong tin nghiep vu cho "don vi thu hoi voucher" (doi tac).
-- Khong sua bang Locations_Detail hien co, chi mo rong 1-1 theo id
-- de tranh anh huong cac he thong dang dung Locations_Group/Locations_Detail.
--
-- KHONG dung FOREIGN KEY toi Locations_Detail(id): tren mot so DB that, cot
-- id cua Locations_Detail (tuy la IDENTITY) chua tung duoc khai bao PRIMARY
-- KEY/UNIQUE - SQL Server bat buoc phai co 1 trong 2 cai do o ben bang duoc
-- tham chieu moi tao duoc FK, neu khong se bao loi "Could not create
-- constraint or index" (msg 1750) luc chay migrate. Vi nguyen tac cua app
-- la KHONG sua cau truc bang cu, ta chi giu UNIQUE tren chinh cot
-- LocationDetailId (khong dung gi toi Locations_Detail) - quan he giua 2
-- bang van hoat dong binh thuong vi code ung dung join bang SQL o tang
-- service, khong phu thuoc FK nay.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RedemptionUnits' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.RedemptionUnits (
        Id                  INT IDENTITY(1,1) PRIMARY KEY,
        LocationDetailId    INT NOT NULL,                 -- lien ket toi Locations_Detail.id (khong dat FK, xem ghi chu tren)
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
        CONSTRAINT UQ_RedemptionUnits_PartnerCode UNIQUE (PartnerCode)
    );
END
GO
