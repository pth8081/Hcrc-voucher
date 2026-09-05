-- =====================================================================
-- 011_create_report_access_control.sql
-- Phan quyen xem bao cao THEO CONG TY (khac voi Users.status - vai tro quan tri he
-- thong). Mac dinh (KHONG can khai bao gi them): 1 tai khoan chi thay du lieu cua DUNG
-- dia diem/cong ty gan voi minh (qua Locations_Detail -> RedemptionUnits -> CompanyId).
-- Muon xem THEM cong ty khac (xem cheo/xem nhieu) hoac xem TOAN BO, gan tai khoan do vao
-- 1 "nhom quyen" duoi day - xem reportAccessService.js.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ReportAccessGroups' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.ReportAccessGroups (
        Id           INT IDENTITY(1,1) PRIMARY KEY,
        GroupName    NVARCHAR(200) NOT NULL,
        ScopeType    NVARCHAR(20)  NOT NULL DEFAULT ('SPECIFIC'), -- 'ALL' hoac 'SPECIFIC'
        CreatedDate  DATETIME NOT NULL DEFAULT (GETDATE()),
        UpdatedDate  DATETIME NULL,
        CONSTRAINT CK_ReportAccessGroups_ScopeType CHECK (ScopeType IN ('ALL', 'SPECIFIC'))
    );
END
GO

-- Danh sach cong ty duoc xem THEM cho 1 nhom co ScopeType = 'SPECIFIC' (bo qua neu ScopeType = 'ALL').
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ReportAccessGroupCompanies' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.ReportAccessGroupCompanies (
        Id         INT IDENTITY(1,1) PRIMARY KEY,
        GroupId    INT NOT NULL,
        CompanyId  INT NOT NULL,
        CONSTRAINT UQ_ReportAccessGroupCompanies UNIQUE (GroupId, CompanyId),
        CONSTRAINT FK_ReportAccessGroupCompanies_Group FOREIGN KEY (GroupId) REFERENCES dbo.ReportAccessGroups (Id),
        CONSTRAINT FK_ReportAccessGroupCompanies_Company FOREIGN KEY (CompanyId) REFERENCES dbo.RedemptionCompanies (Id)
    );
END
GO

-- Gan 1 tai khoan vao TOI DA 1 nhom quyen. Khong co dong o day = mac dinh (chi xem cong ty/dia
-- diem cua chinh minh).
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'UserReportAccess' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.UserReportAccess (
        Id           INT IDENTITY(1,1) PRIMARY KEY,
        UserId       INT NOT NULL,
        GroupId      INT NULL,
        UpdatedBy    NVARCHAR(100) NULL,
        UpdatedDate  DATETIME NOT NULL DEFAULT (GETDATE()),
        CONSTRAINT UQ_UserReportAccess_UserId UNIQUE (UserId),
        CONSTRAINT FK_UserReportAccess_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserID),
        CONSTRAINT FK_UserReportAccess_Group FOREIGN KEY (GroupId) REFERENCES dbo.ReportAccessGroups (Id)
    );
END
GO
