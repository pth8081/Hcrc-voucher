require('dotenv').config();
const cluster = require('cluster');
const createApp = require('./app');
const logger = require('./utils/logger');
const { getPool } = require('./config/db');
const { startSyncScheduler } = require('./utils/syncScheduler');
const { resolveWorkerCount } = require('./utils/clusterConfig');

const PORT = process.env.PORT || 3000;

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
    logger.info(`HCRC Voucher Redemption App (PID ${process.pid}) dang chay tai http://localhost:${PORT}`);
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
  logger.info(`Che do cluster: khoi dong ${workerCount} worker xu ly HTTP (tien trinh chinh PID ${process.pid})`);

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
