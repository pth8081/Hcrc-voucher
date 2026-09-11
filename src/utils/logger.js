const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // H9: phong ho lop 2 - dynamicCoreApiClient.js/coreVoucherService.js da tu xoa header xac
  // thuc truoc khi gan .cause, day chi la luoi an toan them phong truong hop 1 nhanh loi khac
  // sau nay quen lam vay, tranh secret ket noi Core bi ghi ra log dang chu thuong.
  redact: {
    paths: [
      'err.config.headers',
      'err.response.config.headers',
      'err.cause.config.headers',
      'err.cause.response.config.headers',
    ],
    censor: '[REDACTED]',
  },
});

module.exports = logger;
