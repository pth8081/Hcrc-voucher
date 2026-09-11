require('dotenv').config();
const cluster = require('cluster');
const createApp = require('./app');
const logger = require('./utils/logger');
const { getPool } = require('./config/db');
const { startSyncScheduler } = require('./utils/syncScheduler');
const { resolveWorkerCount } = require('./utils/clusterConfig');
const { assertSecretsStrong } = require('./config/env');
const { version: APP_VERSION } = require('../package.json');

const PORT = process.env.PORT || 3000;

// L4: kiem tra do manh cua JWT_SECRET/ENCRYPTION_KEY NGAY luc khoi dong, truoc khi mo cong
// HTTP hay ket noi DB - dung lai voi thong bao ro rang thay vi chay "binh thuong" voi 1 diem
// yeu am tham (xem chi tiet trong config/env.js). Chay o MOI tien trinh (ca worker HTTP lan
// tien trinh chinh chi chay job nen) vi ca 2 deu doc cac bien nay.
try {
  assertSecretsStrong();
} catch (err) {
  logger.error(err.message);
  process.exit(1);
}

/** Ket noi MSSQL + xu ly HTTP - phan viec cua tung worker khi CHAY CLUSTER, hoac cua tien
 * trinh duy nhat khi KHONG chay cluster (CLUSTER_WORKERS=1). */
async function runHttpProcess({ withScheduler }) {
  try {
    await getPool();
    logger.info('Da ket noi MSSQL thanh cong');
  } catch (err) {
    logger.error({ err }, 'Khong the ket noi MSSQL khi khoi dong');
    process.exit(1);
  }

  if (withScheduler) startSyncScheduler();

  const app = createApp();
  app.listen(PORT, () => {
    // In ro version dang chay NGAY TAI DAY (doc thang tu package.json, khong qua pm2) - vi cot
    // "Version" trong "pm2 status" chi doc dung khi tien trinh duoc dang ky dung cach (xem
    // README muc 3e); dong log nay + GET /health luon dung du dang ky pm2 the nao.
    logger.info(`HCRC Voucher Redemption App v${APP_VERSION} (PID ${process.pid}) dang chay tai http://localhost:${PORT}`);
  });
}

/**
 * Tien trinh CHINH khi chay cluster: KHONG nhan request HTTP nao ca (Node tu dong can bang tai
 * request giua cac worker con, tien trinh chinh chi dieu phoi) - chi giu 1 ket noi MSSQL rieng
 * de chay DUY NHAT 1 lan job nen dong bo voucher loi (syncRetryService). Neu de moi worker tu
 * chay job nay se bi lap lai N lan song song, gay goi trung Core API/ghi log trung lap.
 */
async function runSchedulerOnlyProcess() {
  try {
    await getPool();
    logger.info('Da ket noi MSSQL thanh cong (tien trinh chinh - chi chay job nen, khong nhan HTTP)');
  } catch (err) {
    logger.error({ err }, 'Khong the ket noi MSSQL khi khoi dong (tien trinh chinh)');
    process.exit(1);
  }
  startSyncScheduler();
}

function startCluster(workerCount) {
  logger.info(`HCRC Voucher Redemption App v${APP_VERSION} - che do cluster: khoi dong ${workerCount} worker xu ly HTTP (tien trinh chinh PID ${process.pid})`);

  for (let i = 0; i < workerCount; i += 1) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    logger.warn(`Worker PID ${worker.process.pid} da thoat (code=${code}, signal=${signal}) - khoi dong lai sau 1 giay`);
    // Doi 1 chut truoc khi fork lai, tranh vong lap khoi-dong-roi-chet lien tuc chiem CPU neu
    // nguyen nhan la loi cau hinh vinh vien (vd sai DB_PASSWORD) chu khong phai crash tam thoi.
    setTimeout(() => cluster.fork(), 1000);
  });

  runSchedulerOnlyProcess();
}

const workerCount = resolveWorkerCount();

if (workerCount > 1 && cluster.isPrimary) {
  startCluster(workerCount);
} else if (workerCount > 1 && cluster.isWorker) {
  runHttpProcess({ withScheduler: false });
} else {
  // Mac dinh (CLUSTER_WORKERS=1 hoac khong khai bao): 1 tien trinh duy nhat vua xu ly HTTP vua
  // chay job nen, giong het hanh vi truoc khi co tinh nang cluster nay.
  runHttpProcess({ withScheduler: true });
}
