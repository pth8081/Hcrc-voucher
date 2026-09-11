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

// L4: truoc day JWT_SECRET/ENCRYPTION_KEY chi can "co gia tri" (required() o tren, hoac tu
// crypto.js) la chay duoc, khong co canh bao gi neu admin dat 1 gia tri qua ngan/de doan (vd
// "123", "test") luc cai dat lan dau - JWT_SECRET yeu truc tiep lam gia mao duoc token dang
// nhap (ky HMAC), ENCRYPTION_KEY yeu lam giam manh do kho brute-force secret ket noi Core da
// ma hoa trong DB. Kiem tra 1 lan luc khoi dong, dung lai NGAY voi thong bao ro rang thay vi
// chay "binh thuong" voi 1 diem yeu am tham.
const MIN_SECRET_LENGTH = 32;

function assertSecretsStrong() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('Thieu bien moi truong JWT_SECRET - bat buoc phai co de ky token dang nhap.');
  }
  if (jwtSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET qua ngan (${jwtSecret.length} ky tu, can toi thieu ${MIN_SECRET_LENGTH}) - de bi do/brute-force, cho phep gia mao token dang nhap. Tao 1 chuoi ngau nhien du dai, vd: openssl rand -hex 32`
    );
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('Thieu bien moi truong ENCRYPTION_KEY - bat buoc de ma hoa secret ket noi Core API luu trong DB.');
  }
  if (encryptionKey.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY qua ngan (${encryptionKey.length} ky tu, can toi thieu ${MIN_SECRET_LENGTH}) - lam giam do kho brute-force secret ket noi Core da ma hoa trong DB. Tao 1 chuoi ngau nhien du dai, vd: openssl rand -hex 32`
    );
  }
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

module.exports = { getDbConfig, getCoreApiConfig, assertSecretsStrong };
