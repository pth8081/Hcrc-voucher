-- =====================================================================
-- 042_add_can_manage_email_schedules.sql
-- v3.84: tach "Lich gui email bao cao" (email-schedules.html) thanh 1 quyen
-- tinh nang RIENG (quyen tinh nang thu 7) - truoc ban nay, BAT KY tai khoan
-- nao co quyen xem IT NHAT 1 trong 3 loai bao cao (doi soat/tong hop/voucher
-- da su dung) la TU DONG co luon quyen tu dat lich gui email, khong co cong
-- tac rieng. Theo yeu cau: nguoi THIET LAP lich gui email phai la Quan tri
-- doi tac (hoac Quan tri day du HCRC), hoac 1 nhan vien duoc cap RIENG quyen
-- nay - khong phai moi nhan vien co quyen xem bao cao la mac nhien co duoc.
--
-- DEFAULT 0 (TAT) cho MOI tai khoan MOI/chua tung dung - dung yeu cau "mac
-- dinh an het, khong thao tac duoc". De KHONG lam gian doan dot ngot nguoi
-- dang dung that, migration nay "giu nguyen" (grandfather) quyen cho 2
-- truong hop: (1) tai khoan dang la "Quan tri doi tac" (PartnerAdminConnectionId
-- khac NULL); (2) tai khoan dang THUC SU co it nhat 1 lich gui email da tao
-- (dbo.EmailReportSchedules.CreatedByUserId) - ca 2 deu duoc BAT SAN quyen
-- nay ngay sau khi migrate, khong ai dang dung bi khoa nham. Tai khoan Quan
-- tri day du (role=1) luon co san quyen nay qua ADMIN_PERMISSIONS
-- (permissionService.js), khong phu thuoc cot nay.
-- =====================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'CanManageEmailSchedules'
)
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD CanManageEmailSchedules BIT NOT NULL CONSTRAINT DF_VAP_CanManageEmailSchedules DEFAULT 0;
END
GO

-- Grandfather 1: tai khoan DA CO dong du lieu quyen san - bat len cho dung 2
-- truong hop neu tren, KHONG dong gi den cac tai khoan khac (giu nguyen 0).
UPDATE dbo.VoucherAppPermissions
SET CanManageEmailSchedules = 1
WHERE PartnerAdminConnectionId IS NOT NULL
   OR UserId IN (SELECT DISTINCT CreatedByUserId FROM dbo.EmailReportSchedules);
GO

-- Grandfather 2: tai khoan dang THUC SU co lich gui email nhung CHUA TUNG co
-- dong nao trong VoucherAppPermissions (vd tai khoan rat cu) - tao dong moi
-- voi quyen nay BAT SAN, cac quyen tinh nang khac dung dung DEFAULT_PERMISSIONS
-- cua permissionService.js (giu nguyen hanh vi "chua co dong" tu truoc gio).
INSERT INTO dbo.VoucherAppPermissions
    (UserId, CanRedeemVoucher, CanViewReconciliation, CanViewSummary, CanViewUsedVouchers,
     CanViewBusinessGuide, CanViewSystemGuide, CanManageEmailSchedules)
SELECT DISTINCT s.CreatedByUserId, 1, 1, 0, 0, 1, 0, 1
FROM dbo.EmailReportSchedules s
WHERE NOT EXISTS (SELECT 1 FROM dbo.VoucherAppPermissions p WHERE p.UserId = s.CreatedByUserId);
GO
