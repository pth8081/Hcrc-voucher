const userScheduleService = require('../services/userScheduleService');

async function list(req, res, next) {
  try {
    const data = await userScheduleService.listAllWithSchedule();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateSchedule(req, res, next) {
  try {
    const { activeFrom, activeUntil } = req.body;
    if (activeFrom && activeUntil && new Date(activeFrom) > new Date(activeUntil)) {
      return res.status(400).json({ success: false, message: 'Thoi gian kich hoat phai truoc thoi gian het han' });
    }
    await userScheduleService.upsertSchedule(Number(req.params.userId), { activeFrom, activeUntil }, req.user.username);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, updateSchedule };
