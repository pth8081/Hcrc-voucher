-- =====================================================================
-- 029_seed_fuji_connection.sql
-- Tao SAN 1 dong ket noi "Fuji" trong dbo.ApiConnections bang cach SAO CHEP
-- cau hinh (Base URL, duong dan check/redeem, mapping JSON...) tu ket noi
-- dang ACTIVE hien tai (vd "BRGmart"/"HCRC Voucher API Server") - theo
-- dung thuc te da xac nhan: 2 he thong dung CHUNG 1 cong API gateway, chi
-- khac nhau o GIA TRI API KEY (xem README muc 4e). Khong kich hoat lam
-- mac dinh (IsActive = 0) va KHONG sao chep API Key/mat khau that
-- (AuthTokenEncrypted, BasicPasswordEncrypted luon de NULL) - dong nay la
-- BAN NHAP, chua "san sang" nen chua hien ra o chon "He thong voucher"
-- tren man hinh Quet voucher (xem apiConnectionService.js#listOptions) cho
-- toi khi admin dien that.
--
-- De hoan tat: vao "Ket noi API", bam "Sua" dong "Fuji", dien dung Gia tri
-- API Key do doi tac Fuji cung cap roi bam Luu (neu Base URL/duong dan/
-- mapping cua Fuji khac voi ket noi hien tai thi sua lai cac o do truoc).
-- KHONG bat buoc bam "Kich hoat" - Fuji van chon duoc o man Quet voucher
-- ma khong can la ket noi active (active chi quyet dinh lua chon mac dinh).
--
-- An toan chay lai nhieu lan: da co dong ten "Fuji" roi thi khong lam gi;
-- chua co ket noi active nao de sao chep (vd cai dat moi tinh, chua tung
-- cau hinh ket noi nao) thi cung khong lam gi - dung nut "+ Tao ket noi
-- moi" thu cong trong truong hop do.
--
-- Dot ra soat sau phat hien (cung loi nhu sql/023, xem ghi chu chi tiet o do): dieu kien
-- "IF NOT EXISTS ... WHERE Name = N'Fuji'" chi kiem tra TAI THOI DIEM chay, khong phai "migration
-- nay da tung chay chua" - vi scripts/migrate.js chay lai TOAN BO noi dung file nay o MOI lan
-- `npm run migrate`. Neu admin XOA han dong "Fuji" (vd da tu tao/doi ten ket noi rieng, khong
-- can dong mau nua), lan cap nhat code ke tiep se vo tinh TAO LAI dung dong nay, gay nham lan
-- voi cau hinh admin da tu quan ly. Them dieu kien kiem tra dbo.SchemaMigrations (sql/032) de
-- dam bao CHI seed DUNG 1 LAN DAU TIEN - xoa roi se khong bao gio tu dong tao lai nua.
-- =====================================================================
IF (OBJECT_ID('dbo.SchemaMigrations') IS NULL
    OR NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE Filename = N'029_seed_fuji_connection.sql'))
   AND NOT EXISTS (SELECT 1 FROM dbo.ApiConnections WHERE Name = N'Fuji')
BEGIN
    INSERT INTO dbo.ApiConnections
        (Name, IsActive, BaseUrl, AuthType, AuthTokenEncrypted, ApiKeyHeaderName,
         BasicUsername, BasicPasswordEncrypted, TimeoutMs,
         CheckMethod, CheckPath, CheckParamMode, CheckParamName, CheckBodyTemplate, CheckMapping,
         RedeemMethod, RedeemPath, RedeemParamMode, RedeemParamName, RedeemBodyTemplate, RedeemMapping,
         CreatedDate, UpdatedBy)
    SELECT TOP 1
        N'Fuji', 0, BaseUrl, AuthType, NULL, ApiKeyHeaderName,
        BasicUsername, NULL, TimeoutMs,
        CheckMethod, CheckPath, CheckParamMode, CheckParamName, CheckBodyTemplate, CheckMapping,
        RedeemMethod, RedeemPath, RedeemParamMode, RedeemParamName, RedeemBodyTemplate, RedeemMapping,
        GETDATE(), N'migration-029'
    FROM dbo.ApiConnections
    WHERE IsActive = 1
    ORDER BY Id;
END
GO
