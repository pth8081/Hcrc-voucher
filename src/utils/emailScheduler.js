const logger = require('./logger');
const emailScheduleService = require('../services/emailScheduleService');

let timer = null;
let running = false;

/**
 * Job nen kiem tra VA GUI cac lich bao cao qua email den han - chay moi phut (du "Gio gui" chi
 * chinh xac den phut, khong can tan suat nhanh hon). Cau hinh qua .env, khong can sua code:
 *   EMAIL_SCHEDULER_ENABLED=true|false   (mac dinh true)
 *
 * Dung chung pattern voi syncScheduler.js (guard `running` tranh chong lan neu 1 lot gui cham
 * hon 1 phut, vd nhieu lich cung gio hoac may chu SMTP cham).
 */
function startEmailScheduler() {
  const enabled = (process.env.EMAIL_SCHEDULER_ENABLED ?? 'true') === 'true';
  if (!enabled) {
    logger.info('Email schedule job dang TAT (EMAIL_SCHEDULER_ENABLED=false)');
    return;
  }
  logger.info('Email schedule job bat dau, kiem tra moi phut');
  timer = setInterval(runOnce, 60 * 1000);
  timer.unref?.();
}

function stopEmailScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

async function runOnce() {
  if (running) {
    logger.warn('Bo qua lot kiem tra lich email vi lot truoc chua xong');
    return;
  }
  running = true;
  try {
    const due = await emailScheduleService.findDueSchedules();
    for (const schedule of due) {
      // eslint-disable-next-line no-await-in-loop
      await sendOne(schedule);
    }
  } catch (err) {
    logger.error({ err }, 'Email schedule job loi khong mong doi luc tim lich den han');
  } finally {
    running = false;
  }
}

async function sendOne(schedule) {
  try {
    await emailScheduleService.sendScheduleNow(schedule);
    await emailScheduleService.markSent(schedule.Id, 'SUCCESS', null);
    logger.info(`Da gui email bao cao tu dong "${schedule.Name}" (id=${schedule.Id})`);
  } catch (err) {
    await emailScheduleService.markSent(schedule.Id, 'FAILED', err.publicMessage || err.message).catch(() => {});
    logger.error({ err }, `Gui email bao cao tu dong "${schedule.Name}" (id=${schedule.Id}) that bai`);
  }
}

module.exports = { startEmailScheduler, stopEmailScheduler, runOnce };
