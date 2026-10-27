-- =====================================================================
-- 040_add_created_by_partner_connection_access_group.sql
-- v3.81: cho phep "Quan tri doi tac" tu tao "Nhom quyen xem bao cao" RIENG
-- cua ho (giong het mau da lam cho Cong ty/Diem tieu - sql/035, sql/038) -
-- can 1 co "chu so huu" tren ReportAccessGroups. NULL = tao qua man hinh
-- quan tri day du (HCRC), nhu toan bo du lieu hien co - khong anh huong
-- gi den du lieu cu.
--
-- QUAN TRONG (bao mat): voi 1 nhom quyen CO chu (CreatedByPartnerConnectionId
-- khac NULL), ScopeType='ALL' KHONG duoc hieu la "toan bo moi cong ty trong
-- he thong" (se lo du lieu cua HCRC/doi tac khac) - phai hieu la "toan bo
-- cong ty CUA DUNG DOI TAC DO" - xem reportAccessService.js#resolveVisibleLocationCodes.
-- =====================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.ReportAccessGroups') AND name = 'CreatedByPartnerConnectionId'
)
BEGIN
    ALTER TABLE dbo.ReportAccessGroups ADD CreatedByPartnerConnectionId INT NULL;
END
GO
