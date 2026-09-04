-- =====================================================================
-- 008_create_user_account_schedule.sql
-- Cho phep dat "thoi han su dung" cho tung tai khoan (cap cho doi tac/nhan vien theo hop
-- dong co thoi han) MA KHONG sua bang dbo.Users co san. Kiem tra la SONG tai thoi diem dang
-- nhap (so voi thoi gian hien tai), khong can job nen dinh ky:
--   - ActiveFrom  IS NULL hoac <= now  -> da den han duoc kich hoat
--   - ActiveUntil IS NULL hoac >= now  -> chua het han
-- Thieu 1 trong 2 dieu kien tren la bi tu choi dang nhap (xem authService.js).
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'UserAccountSchedule' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.UserAccountSchedule (
        Id           INT IDENTITY(1,1) PRIMARY KEY,
        UserId       INT NOT NULL,
        ActiveFrom   DATETIME NULL,      -- NULL = kich hoat ngay, khong gioi han thoi diem bat dau
        ActiveUntil  DATETIME NULL,      -- NULL = khong co han su dung
        UpdatedBy    NVARCHAR(100) NULL, -- ten dang nhap admin da dat/sua lich gan nhat
        UpdatedDate  DATETIME NOT NULL DEFAULT (GETDATE()),
        CONSTRAINT UQ_UserAccountSchedule_UserId UNIQUE (UserId),
        CONSTRAINT FK_UserAccountSchedule_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserID)
    );
END
GO
