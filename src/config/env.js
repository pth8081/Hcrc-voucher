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
      max: 10,
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
