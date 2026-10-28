-- =====================================================================
-- 043_add_company_type_and_partner_account.sql
-- Theo yeu cau nguoi dung: phan biet 2 LOAI cong ty -
--   REDEMPTION (Cong ty thu hoi, mac dinh - giu nguyen hanh vi hien tai:
--     co the gan Diem tieu, tai khoan gan vao dung duoc chuc nang thu hoi)
--   PARTNER (Cong ty doi tac - loai MOI: chi luu thong tin cong ty, KHONG
--     duoc gan Diem tieu nao, tai khoan gan vao MAC DINH khong co chuc
--     nang thu hoi cho den khi cong ty doi lai thanh REDEMPTION).
-- Luu y: chu "doi tac" o day la 1 nghia KHAC voi "doi tac" = ApiConnections
-- (he thong voucher Fuji/BRGmart...) da dung xuyen suot tu truoc - 2 khai
-- niem doc lap, chi trung ten goi theo dung yeu cau nguoi dung.
--
-- CompanyId tren VoucherAppPermissions: TRUOC ban nay, "cong ty cua 1 tai
-- khoan" LUON la gia tri SUY RA (qua Users.Locations_Detail -> RedemptionUnits
-- -> RedemptionCompanies, xem reportService.js), KHONG bao gio luu truc tiep -
-- o newCompanyId tren form tao tai khoan (users.html/partner-admin.html)
-- truoc nay chi dung de LOC o chon Diem tieu, khong duoc gui len server.
-- Vi 1 "Cong ty doi tac" KHONG THE co Diem tieu (nen khong co duong suy ra
-- qua Locations_Detail), tai khoan muon duoc coi la "thuoc" 1 cong ty doi
-- tac BAT BUOC phai co 1 LIEN KET TRUC TIEP toi cong ty - them cot nay de
-- luu dung lien ket do (ap dung cho CA 2 loai cong ty, khong chi rieng
-- Cong ty doi tac, de nhat quan 1 nguon du lieu).
--
-- IsPartnerAccount: co the BAT CHI KHI tai khoan dang CompanyId toi 1 cong
-- ty CompanyType = 'PARTNER' (kiem tra o tang service, xem userAdminService.js/
-- partnerAdminService.js) - tai khoan dang BAT se bi ep CanRedeemVoucher = 0
-- va khong gan duoc Diem tieu/Locations_Detail nao.
-- =====================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.RedemptionCompanies') AND name = 'CompanyType'
)
BEGIN
    ALTER TABLE dbo.RedemptionCompanies ADD CompanyType NVARCHAR(20) NOT NULL DEFAULT ('REDEMPTION');
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'CompanyId'
)
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD CompanyId INT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'IsPartnerAccount'
)
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD IsPartnerAccount BIT NOT NULL DEFAULT (0);
END
GO
