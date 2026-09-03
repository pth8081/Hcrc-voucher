-- =====================================================================
-- 005_create_voucher_exelogs_if_missing.sql
-- Bang Voucher_Exelogs da co san trong schema goc cua HCRC (dung de log
-- cac lan chay tien trinh dong bo/tich hop). Migration nay CHI tao bang
-- neu chua ton tai (moi truong dev/test/demo chua co san du lieu goc),
-- giu dung cau truc nhu schema ban da cung cap - khong doi gi tren
-- production da co bang nay.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Voucher_Exelogs' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Voucher_Exelogs (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        Messenger       NVARCHAR(1000) NULL,
        p_tatus         NVARCHAR(20)   NULL,
        p_key           NVARCHAR(60)   NULL,
        pro_name        NVARCHAR(300)  NULL,
        UniqueID_Group  NVARCHAR(100)  NULL,
        createdate      DATE           NULL,
        Sync_Record     INT            NULL,
        strSQL          NVARCHAR(MAX)  NULL,
        iDesc           NVARCHAR(MAX)  NULL
    );

    CREATE INDEX IX_Voucher_Exelogs_ProName_PKey ON dbo.Voucher_Exelogs (pro_name, p_key);
END
GO
