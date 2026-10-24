-- =====================================================================
-- 034_create_email_report_schedules.sql
-- Lich gui bao cao qua email tu dong (dinh ky ngay/tuan/thang) - moi dong la 1 lich do 1 tai
-- khoan (CreatedByUserId) tao ra. Pham vi du lieu bao cao KHONG luu co dinh trong bang nay (tru
-- cac bo loc TUY CHON ben duoi) - duoc TINH LAI MOI LAN GUI tu quyen HIEN TAI cua chinh tai
-- khoan da tao lich (giong het cach man hinh Bao cao tinh quyen cho nguoi dang xem, xem
-- emailScheduleService.js#resolveScheduleScope) - dam bao 1 lich do tai khoan "Quan tri doi tac"
-- Fuji tao LUON CHI gui dung du lieu Fuji, ke ca neu quyen cua tai khoan do thay doi sau nay.
--
-- Khong dat FOREIGN KEY toi Users/ApiConnections/RedemptionCompanies/RedemptionUnits - cung quy
-- uoc da dung xuyen suot cac bang app tu tao khac trong du an (xem 001_create_redemption_units.sql).
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EmailReportSchedules' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.EmailReportSchedules (
        Id                  INT NOT NULL PRIMARY KEY IDENTITY(1,1),
        Name                NVARCHAR(200) NOT NULL,
        ReportType          NVARCHAR(20) NOT NULL,       -- 'DAILY' | 'SUMMARY' | 'USED_VOUCHERS'
        DateRangeMode       NVARCHAR(20) NOT NULL,       -- 'YESTERDAY' | 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'LAST_MONTH'
        CompanyId           INT NULL,                    -- loc THEM tuy chon (giong o loc "Cong ty" tren man hinh bao cao)
        RedemptionUnitId    INT NULL,                    -- loc THEM tuy chon (giong o loc "Diem thu hoi")
        ConnectionId        INT NULL,                    -- loc THEM tuy chon 1 he thong cu the (chi co y nghia voi tai khoan duoc xem nhieu he thong - vd admin; tai khoan bi gioi han van LUON bi loc dung quyen thuc te cua ho bat ke cot nay, xem emailScheduleService.js)
        Recipients          NVARCHAR(1000) NOT NULL,     -- danh sach email nguoi nhan, cach nhau dau phay
        Frequency           NVARCHAR(20) NOT NULL,       -- 'DAILY' | 'WEEKLY' | 'MONTHLY'
        SendHour            TINYINT NOT NULL,
        SendMinute          TINYINT NOT NULL,
        WeekDay             TINYINT NULL,                -- 0 (Chu nhat) - 6 (Thu bay), bat buoc khi Frequency='WEEKLY'
        MonthDay            TINYINT NULL,                -- 1-31, bat buoc khi Frequency='MONTHLY'
        IsEnabled           BIT NOT NULL DEFAULT (1),
        CreatedByUserId     INT NOT NULL,
        CreatedByUsername   NVARCHAR(100) NULL,
        CreatedDate         DATETIME NOT NULL DEFAULT (GETDATE()),
        UpdatedDate         DATETIME NULL,
        LastSentDate        DATETIME NULL,
        LastSentStatus      NVARCHAR(20) NULL,           -- 'SUCCESS' | 'FAILED'
        LastSentMessage     NVARCHAR(1000) NULL
    );
END
GO
