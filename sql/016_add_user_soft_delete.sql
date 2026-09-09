-- =====================================================================
-- 016_add_user_soft_delete.sql
-- Them "xoa mem" tai khoan (nut Xoa o man hinh Tai khoan) - CHI them cot vao bang
-- UserAccountSchedule (bang do app nay tao rieng o migration 008, KHONG phai bang dung chung
-- voi Core/vpdt-dms nen duoc phep ALTER), KHONG dong nao sua bang dbo.Users co san.
--
-- Tai khoan bi danh dau IsDeleted=1:
--   - Khong dang nhap duoc nua (xem userScheduleService.js#assertAccountActive)
--   - An khoi danh sach mac dinh o man hinh Tai khoan (co the bat lai de xem/khoi phuc)
-- Day la "xoa mem" - co the Khoi phuc lai duoc bat ky luc nao, khong mat du lieu.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.UserAccountSchedule') AND name = 'IsDeleted')
BEGIN
    ALTER TABLE dbo.UserAccountSchedule ADD IsDeleted BIT NOT NULL DEFAULT (0);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.UserAccountSchedule') AND name = 'DeletedDate')
BEGIN
    ALTER TABLE dbo.UserAccountSchedule ADD DeletedDate DATETIME NULL;
END
GO
