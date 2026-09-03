-- =====================================================================
-- 004_create_api_connections.sql
-- Luu cau hinh ket noi Core Voucher API do ADMIN tu khai bao qua UI
-- (base URL, auth, endpoint check/redeem, mapping field response).
-- Cho phep them nhieu ket noi (vi du: Test / Production) nhung chi
-- 1 ket noi duoc IsActive = 1 tai 1 thoi diem - la ket noi app dang dung.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ApiConnections' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.ApiConnections (
        Id                      INT IDENTITY(1,1) PRIMARY KEY,
        Name                    NVARCHAR(100) NOT NULL,
        IsActive                BIT NOT NULL DEFAULT (0),

        BaseUrl                 NVARCHAR(500) NOT NULL,
        AuthType                NVARCHAR(20)  NOT NULL DEFAULT ('NONE'), -- NONE | BEARER | API_KEY_HEADER | BASIC
        AuthTokenEncrypted      NVARCHAR(1000) NULL,                     -- Bearer token hoac API key (ma hoa AES-256-GCM)
        ApiKeyHeaderName        NVARCHAR(100) NULL,                      -- ten header khi AuthType = API_KEY_HEADER
        BasicUsername           NVARCHAR(200) NULL,
        BasicPasswordEncrypted  NVARCHAR(1000) NULL,
        TimeoutMs               INT NOT NULL DEFAULT (8000),

        CheckMethod             NVARCHAR(10)  NOT NULL DEFAULT ('GET'),
        CheckPath               NVARCHAR(500) NOT NULL,                  -- vd: /api/vouchers/{code}/status
        CheckParamMode          NVARCHAR(10)  NOT NULL DEFAULT ('PATH'), -- PATH | QUERY | BODY
        CheckParamName          NVARCHAR(100) NULL,                      -- ten query/body param (khong dung khi PATH)
        CheckBodyTemplate       NVARCHAR(MAX) NULL,                      -- JSON template khi CheckParamMode = BODY (tuy chon)
        CheckMapping            NVARCHAR(MAX) NOT NULL,                  -- JSON: duong dan field trong response

        RedeemMethod            NVARCHAR(10)  NOT NULL DEFAULT ('POST'),
        RedeemPath              NVARCHAR(500) NOT NULL,
        RedeemParamMode         NVARCHAR(10)  NOT NULL DEFAULT ('BODY'),
        RedeemParamName         NVARCHAR(100) NULL,
        RedeemBodyTemplate      NVARCHAR(MAX) NULL,                      -- JSON template co the dung {code}{username}{locationsGroup}{locationsDetail}{transNum}
        RedeemMapping           NVARCHAR(MAX) NOT NULL,

        CreatedDate             DATETIME NOT NULL DEFAULT (GETDATE()),
        UpdatedDate              DATETIME NULL,
        UpdatedBy               NVARCHAR(100) NULL
    );

    CREATE INDEX IX_ApiConnections_IsActive ON dbo.ApiConnections (IsActive);
END
GO

-- Log lai lich su goi test tu man hinh cau hinh (khac voi VoucherScanLogs la log nghiep vu that)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ApiConnectionTestLogs' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.ApiConnectionTestLogs (
        Id              BIGINT IDENTITY(1,1) PRIMARY KEY,
        ConnectionId    INT NULL,
        Action          NVARCHAR(10) NOT NULL,   -- CHECK | REDEEM
        VoucherCode     NVARCHAR(24) NOT NULL,
        RequestUrl      NVARCHAR(1000) NULL,
        HttpStatus      INT NULL,
        LatencyMs       INT NULL,
        Success         BIT NOT NULL DEFAULT (0),
        RawResponse     NVARCHAR(MAX) NULL,
        NormalizedResult NVARCHAR(MAX) NULL,
        ErrorMessage    NVARCHAR(1000) NULL,
        TestedBy        NVARCHAR(100) NULL,
        CreatedDate     DATETIME NOT NULL DEFAULT (GETDATE())
    );
END
GO
