require('dotenv').config();
const createApp = require('./app');
const logger = require('./utils/logger');
const { getPool } = require('./config/db');

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await getPool();
    logger.info('Da ket noi MSSQL thanh cong');
  } catch (err) {
    logger.error({ err }, 'Khong the ket noi MSSQL khi khoi dong');
    process.exit(1);
  }

  const app = createApp();
  app.listen(PORT, () => {
    logger.info(`HCRC Voucher Redemption App dang chay tai http://localhost:${PORT}`);
  });
}

start();
