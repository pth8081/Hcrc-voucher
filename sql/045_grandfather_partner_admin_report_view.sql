-- =====================================================================
-- 045_grandfather_partner_admin_report_view.sql
-- v3.98 (theo yeu cau nguoi dung): tai khoan "Quan tri doi tac" (PartnerAdminConnectionId
-- khac NULL) truoc ban nay CHI mac dinh co san quyen CanViewReconciliation (DEFAULT_PERMISSIONS,
-- permissionService.js) - CanViewSummary/CanViewUsedVouchers VAN false cho den khi HCRC tu tick
-- rieng o man "Tai khoan", du tai khoan do da la Quan tri doi tac. Theo phan anh cua nguoi dung:
-- bat tien, Quan tri doi tac nen MAC DINH xem duoc CA 3 bao cao ngay (giong vai tro admin HCRC -
-- xem ADMIN_PERMISSIONS - nhung gioi han dung he thong cua ho).
--
-- Khong them cot moi (3 cot nay da co san tu dau) - chi BACKFILL du lieu cho cac tai khoan Quan
-- tri doi tac HIEN CO, de khong ai dang dung bi "mat quyen" cho den khi HCRC tinh co vao sua lai.
-- Tai khoan Quan tri doi tac MOI (gan tu nay tro di) duoc cap tu dong qua
-- permissionService.js#grantReportViewAccess (goi tu user.controller.js#updatePartnerAdmin).
-- Moi tai khoan Quan tri doi tac chac chan DA CO 1 dong trong bang nay (setPartnerAdminConnection()
-- luon upsert), nen khong can grandfather "chua co dong" nhu sql/042.
-- =====================================================================
UPDATE dbo.VoucherAppPermissions
SET CanViewReconciliation = 1, CanViewSummary = 1, CanViewUsedVouchers = 1
WHERE PartnerAdminConnectionId IS NOT NULL
  AND (CanViewReconciliation = 0 OR CanViewSummary = 0 OR CanViewUsedVouchers = 0);
GO
