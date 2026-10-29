-- =====================================================================
-- 050_add_voucher_filter_view_permission.sql
-- Theo yeu cau nguoi dung: ben canh 2 quyen SUA man "Loc ma voucher" da co
-- (sql/049), them 2 quyen XEM RIENG (CHI XEM, khong sua gi ca) - cho ca
-- Quan tri HCRC lan Quan tri doi tac. Vao duoc man hinh neu co IT NHAT 1
-- trong 2 quyen (Sua HOAC Xem); CHI quyen Sua moi luu duoc - xem
-- requireVoucherFilterAccess.js.
--
-- DEFAULT 0 (giong het 2 cot AdminCanManageVoucherFilter/PartnerAdminCan
-- ManageVoucherFilter cua sql/049) - nang luc HOAN TOAN MOI, khong tu
-- dong co san cho ai.
-- =====================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'AdminCanViewVoucherFilter'
)
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD AdminCanViewVoucherFilter BIT NOT NULL CONSTRAINT DF_VAP_AdminCanViewVoucherFilter DEFAULT 0;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'PartnerAdminCanViewVoucherFilter'
)
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD PartnerAdminCanViewVoucherFilter BIT NOT NULL CONSTRAINT DF_VAP_PartnerAdminCanViewVoucherFilter DEFAULT 0;
END
GO
