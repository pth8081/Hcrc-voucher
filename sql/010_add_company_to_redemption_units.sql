-- =====================================================================
-- 010_add_company_to_redemption_units.sql
-- Gan moi diem tieu (RedemptionUnits) vao 1 Cong ty (RedemptionCompanies) - cho phep 1
-- cong ty co nhieu diem tieu. NULL duoc phep de khong pha du lieu da co truoc khi co
-- khai niem Cong ty (nhung man hinh "Don vi thu hoi" se bat buoc chon Cong ty khi tao moi).
-- =====================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.RedemptionUnits') AND name = 'CompanyId'
)
BEGIN
    ALTER TABLE dbo.RedemptionUnits ADD CompanyId INT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_RedemptionUnits_RedemptionCompanies'
)
BEGIN
    ALTER TABLE dbo.RedemptionUnits
        ADD CONSTRAINT FK_RedemptionUnits_RedemptionCompanies
        FOREIGN KEY (CompanyId) REFERENCES dbo.RedemptionCompanies (Id);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_RedemptionUnits_CompanyId'
)
BEGIN
    CREATE INDEX IX_RedemptionUnits_CompanyId ON dbo.RedemptionUnits (CompanyId);
END
GO
