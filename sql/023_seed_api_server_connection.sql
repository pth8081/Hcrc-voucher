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
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.ApiConnections WHERE Name = N'API Server - HCRC Report')
BEGIN
    INSERT INTO dbo.ApiConnections
        (Name, IsActive, BaseUrl, AuthType, AuthTokenEncrypted, ApiKeyHeaderName,
         TimeoutMs, CheckMethod, CheckPath, CheckParamMode, CheckParamName, CheckMapping,
         RedeemMethod, RedeemPath, RedeemParamMode, RedeemParamName, RedeemBodyTemplate, RedeemMapping,
         CreatedDate, UpdatedBy)
    VALUES
        (N'API Server - HCRC Report', 0, N'https://DIEN-DIA-CHI-THAT-VAO-DAY.example', 'API_KEY_HEADER', NULL, 'X-API-Key',
         8000, 'POST', '/api/v1/vouchers/check', 'BODY', 'voucherCode',
         N'{"statusPath":"data.status","serialPath":"data.voucherSerial","valueAmtPath":"data.valueAmt","issueDatePath":"data.issueDate","expiryDatePath":"data.expiryDate","messagePath":"data.message"}',
         'POST', '/api/v1/vouchers/redeem', 'BODY', 'voucherCode',
         N'{"voucherCode":"{code}"}',
         N'{"successPath":"data.success","statusPath":"data.status","transRefPath":"data.transNum","redeemedAtPath":"data.redeemedAt","messagePath":"data.message"}',
         GETDATE(), N'migration-023');
END
GO
