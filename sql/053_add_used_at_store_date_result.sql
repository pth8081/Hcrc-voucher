-- =====================================================================
-- 053_add_used_at_store_date_result.sql
-- "Doi soat cheo Core" (sql/052/v4.15): luu THEM gia tri THO cua truong "Thoi gian tieu tai cua
-- hang" (usedAtStoreDate - xem dynamicCoreApiClient.js) ma Core tra ve cho TUNG voucher, de nguoi
-- dung tu xem truc tiep tren man hinh/Excel la NULL hay co gia tri, khong chi doc qua ghi chu giai
-- thich (CoreMessage, chi co khi CHUA KHOP). Luu dang NVARCHAR (khong phai DATETIME2) vi day la gia
-- tri THO tu he thong doi tac - dinh dang co the khac nhau tuy tung Core, khong ep parse o day de
-- tranh that bai ghi du lieu neu dinh dang la (vd khong phai ISO chuan).
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.CoreReconciliationResults') AND name = 'UsedAtStoreDate')
BEGIN
    ALTER TABLE dbo.CoreReconciliationResults ADD UsedAtStoreDate NVARCHAR(100) NULL;
END
GO
