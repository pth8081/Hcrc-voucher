const logger = require('./logger');
const { processPendingSyncs } = require('../services/syncRetryService');

let timer = null;
let running = false;

/**
 * Khoi dong job tu dong dong bo lai cac voucher dang cho (VOUCHER_SYNC.Sync = 'N').
 * Cau hinh qua .env, khong can sua code:
 *   SYNC_RETRY_ENABLED=true|false        (mac dinh true)
 *   SYNC_RETRY_INTERVAL_MINUTES=5        (chu ky chay, phut)
 *   SYNC_RETRY_BATCH_SIZE=20             (so ban ghi toi da moi lot)
 *   SYNC_RETRY_MAX_ATTEMPTS=20           (so lan thu lai toi da/1 ban ghi)
 */
function startSyncScheduler() {
  const enabled = (process.env.SYNC_RETRY_ENABLED ?? 'true') === 'true';
  if (!enabled) {
    logger.info('Sync retry job dang TAT (SYNC_RETRY_ENABLED=false)');
    return;
  }

  const intervalMinutes = Number(process.env.SYNC_RETRY_INTERVAL_MINUTES || 5);
  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;

  logger.info(`Sync retry job bat dau, chay moi ${intervalMinutes} phut`);
  timer = setInterval(runOnce, intervalMs);
  timer.unref?.();
}

function stopSyncScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

async function runOnce() {
  if (running) {
    logger.warn('Bo qua lot chay sync retry vi lot truoc chua xong');
    return;
  }
  running = true;
  try {
    const result = await processPendingSyncs();
    if (result.processed > 0) {
      logger.info(result, 'Sync retry job hoan tat 1 lot');
    }
  } catch (err) {
    logger.error({ err }, 'Sync retry job loi khong mong doi');
  } finally {
    running = false;
  }
}

module.exports = { startSyncScheduler, stopSyncScheduler, runOnce };
