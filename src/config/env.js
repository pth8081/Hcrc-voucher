function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getDbConfig() {
  return {
    server: required('DB_SERVER'),
    port: Number(process.env.DB_PORT || 1433),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    options: {
      encrypt: (process.env.DB_ENCRYPT || 'true') === 'true',
      trustServerCertificate: (process.env.DB_TRUST_SERVER_CERT || 'true') === 'true',
    },
    pool: {
      // Tu dot ra soat sau merge PR #31: khoa sp_getapplock cho thu hoi voucher (C1/H5, xem
      // voucherService.js#redeemAndInsertGuarded) gio giu 1 transaction/ket noi trong pool nay
      // XUYEN SUOT ca thoi gian cho Core API phan hoi (toi da MAX_TIMEOUT_MS = 10s, xem
      // apiConnectionService.js), khong chi buoc ghi DB nhanh nhu truoc - nen pool can du lon de
      // chiu duoc nhieu luot thu hoi dong thoi ma khong lam "doi" ca cac truy van khac (bao cao,
      // dang nhap...). Co the tang them qua DB_POOL_MAX neu luu luong thu hoi dong thoi cao.
      max: Number(process.env.DB_POOL_MAX || 20),
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

function getCoreApiConfig() {
  return {
    baseURL: required('CORE_API_BASE_URL'),
    apiKey: required('CORE_API_KEY'),
    checkPath: process.env.CORE_API_CHECK_PATH || '/api/vouchers/check',
    redeemPath: process.env.CORE_API_REDEEM_PATH || '/api/vouchers/redeem',
    timeout: Number(process.env.CORE_API_TIMEOUT_MS || 8000),
  };
}

module.exports = { getDbConfig, getCoreApiConfig };
