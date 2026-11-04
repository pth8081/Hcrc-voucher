-- =====================================================================
-- 051_add_last_login_date.sql
-- Them LastLoginDate (NULL = chua tung dang nhap, hoac da dang xuat ro rang) vao
-- dbo.UserPasswordPolicy (bang da co tu migration 012/025/036) - phuc vu tinh nang canh bao
-- "tai khoan nay co the dang dang nhap o noi khac" TRUOC KHI hoan tat dang nhap (theo yeu cau
-- nguoi dung), dua tren suy doan hop ly: neu LastLoginDate gan day (trong SESSION_CONFLICT_WINDOW_HOURS
-- gio, xem sessionVersionService.js), coi la "co the van dang hoat dong".
--
-- Khac voi SessionVersion (chi la 1 bo dem tang dan, khong co y nghia thoi gian), cot nay ghi
-- THOI DIEM that: duoc set = GETDATE() moi lan dang nhap THANH CONG (authService.js#issueSession),
-- va duoc XOA VE NULL khi dang xuat RO RANG (API logout moi, src/controllers/auth.controller.js)
-- - phan biet ro "vua dang nhap gan day" voi "da chu dong dang xuat", tranh canh bao gia cho
-- nguoi da dang xuat sach se o thiet bi cu.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.UserPasswordPolicy') AND name = 'LastLoginDate')
BEGIN
    ALTER TABLE dbo.UserPasswordPolicy ADD LastLoginDate DATETIME2 NULL;
END
GO
