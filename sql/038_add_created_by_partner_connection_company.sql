-- =====================================================================
-- 038_add_created_by_partner_connection_company.sql
-- Mo rong quyen tu phuc vu cua "Quan tri doi tac" (v3.76): cho phep doi
-- tac tu tao "Cong ty"/"Diem tieu" rieng cua ho (phuc vu nhom bao cao/doi
-- soat noi bo), CHI thay/sua duoc dung cac ban ghi do CHINH ho tao ra -
-- can 1 co "chu so huu" tren RedemptionCompanies, giong het mau da lam
-- cho tai khoan (VoucherAppPermissions.CreatedByPartnerConnectionId,
-- sql/035). NULL = tao qua man hinh quan tri day du (HCRC), nhu toan bo
-- du lieu hien co - khong anh huong gi den du lieu cu.
--
-- RedemptionUnits (diem tieu) KHONG can cot rieng - ke thua "chu so huu"
-- qua CompanyId (1 diem tieu luon thuoc dung 1 cong ty), tranh 2 nguon
-- su that phai dong bo voi nhau.
-- =====================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.RedemptionCompanies') AND name = 'CreatedByPartnerConnectionId'
)
BEGIN
    ALTER TABLE dbo.RedemptionCompanies ADD CreatedByPartnerConnectionId INT NULL;
END
GO
