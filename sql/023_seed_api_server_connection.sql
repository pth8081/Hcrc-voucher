-- =====================================================================
-- 023_seed_api_server_connection.sql
-- Tao SAN 1 dong ket noi trong dbo.ApiConnections (chua kich hoat, chua co
-- API Key) khop voi hop dong cua "API Server" (he thong noi bo goi truc
-- tiep vao CSDL DSMART16 Live, bang PMCRDINF) - de admin KHONG can bam
-- "+ Tao ket noi moi" tren man hinh "Ket noi API" nua, chi can bam "Sua"
-- vao dong co san nay va dien 2 o: Base URL that + Gia tri API Key that.
-- Day la du lieu CUA RIENG APP NAY (khong dung cham bang Core), an toan
-- them/sua lai nhieu lan - KHONG bao gio chua gia tri API Key that trong
-- migration (se bi lo neu commit len git).
--
-- Dot ra soat sau phat hien (loi that da xay ra o production): scripts/migrate.js CHAY LAI
-- TOAN BO noi dung MOI file .sql o thu muc nay o MOI lan `npm run migrate` (vd moi lan cap nhat
-- code len ban moi) - dieu kien "IF NOT EXISTS ... WHERE Name = ..." o duoi CHI kiem tra dong
-- do co dang ton tai hay khong TAI THOI DIEM chay, khong phai "migration nay da tung chay chua".
-- He qua: neu admin XOA han dong "HCRC Voucher API Server" nay tren giao dien (vd da tao rieng
-- 1 ket noi khac thay the, khong can dong mau nua), LAN CAP NHAT CODE KE TIEP se vo tinh TAO LAI
-- dung dong nay (ban nhap trong, IsActive=0) - de lam admin tuong nham co ket noi la/trung voi
-- cau hinh ho da tu quan ly. Them dieu kien kiem tra dbo.SchemaMigrations (bang theo doi file da
-- ap dung, tao o sql/032) - CHI seed khi CA 2 dung: (1) migration nay CHUA tung ap dung thanh
-- cong lan nao truoc do (hoac dang cai dat moi tinh, SchemaMigrations con chua ton tai), VA
-- (2) chua co dong ten nay. Ca 2 tao thanh "chi seed DUNG 1 LAN DAU TIEN", xoa roi se KHONG
-- BAO GIO tu dong tao lai nua, du chay migrate bao nhieu lan sau do.
-- =====================================================================
IF (OBJECT_ID('dbo.SchemaMigrations') IS NULL
    OR NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE Filename = N'023_seed_api_server_connection.sql'))
   AND NOT EXISTS (SELECT 1 FROM dbo.ApiConnections WHERE Name = N'HCRC Voucher API Server')
BEGIN
    INSERT INTO dbo.ApiConnections
        (Name, IsActive, BaseUrl, AuthType, AuthTokenEncrypted, ApiKeyHeaderName,
         TimeoutMs, CheckMethod, CheckPath, CheckParamMode, CheckParamName, CheckMapping,
         RedeemMethod, RedeemPath, RedeemParamMode, RedeemParamName, RedeemBodyTemplate, RedeemMapping,
         CreatedDate, UpdatedBy)
    VALUES
        (N'HCRC Voucher API Server', 0, N'https://DIEN-DIA-CHI-THAT-VAO-DAY.example', 'API_KEY_HEADER', NULL, 'X-API-Key',
         8000, 'POST', '/api/v1/vouchers/check', 'BODY', 'voucherCode',
         N'{"statusPath":"data.status","serialPath":"data.voucherSerial","valueAmtPath":"data.valueAmt","issueDatePath":"data.issueDate","expiryDatePath":"data.expiryDate","messagePath":"data.message"}',
         'POST', '/api/v1/vouchers/redeem', 'BODY', 'voucherCode',
         N'{"voucherCode":"{code}"}',
         N'{"successPath":"data.success","statusPath":"data.status","transRefPath":"data.transNum","redeemedAtPath":"data.redeemedAt","messagePath":"data.message"}',
         GETDATE(), N'migration-023');
END
GO
