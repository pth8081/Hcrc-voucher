-- =====================================================================
-- 044_add_redemption_unit_ids_email_schedule.sql
-- Theo yeu cau nguoi dung: man "Lich gui email bao cao" truoc day CHI cho
-- chon DUNG 1 Diem thu hoi (cot RedemptionUnitId, xem sql/034) - 1 lich
-- muon gui nhieu diem CUNG 1 cong ty phai tao nhieu lich rieng le, bat
-- tien. Them cot MOI RedemptionUnitIds (chuoi "1,5,9" cach nhau dau phay,
-- CUNG kieu voi cot ConnectionIds da co san o sql/034) de cho tick NHIEU
-- Diem thu hoi cung luc, giong het cach o "He thong voucher" dang lam.
--
-- GIU NGUYEN cot RedemptionUnitId cu (KHONG xoa/doi ten) - cac lich da
-- tao truoc ban nay van doc duoc binh thuong qua cot cu nay
-- (emailScheduleService.js#rowToDto tu dong "that lui" ve cot cu neu
-- RedemptionUnitIds con rong) - tranh mat du lieu/gay loi lich dang chay.
-- Lich TAO MOI/SUA sau ban nay se ghi qua cot moi, khong dong gi den cot
-- cu nua.
-- =====================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.EmailReportSchedules') AND name = 'RedemptionUnitIds'
)
BEGIN
    ALTER TABLE dbo.EmailReportSchedules ADD RedemptionUnitIds NVARCHAR(500) NULL;
END
GO
