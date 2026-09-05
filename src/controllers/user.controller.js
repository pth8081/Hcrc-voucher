const userScheduleService = require('../services/userScheduleService');
const reportAccessService = require('../services/reportAccessService');

async function list(req, res, next) {
  try {
    const [withSchedule, withAccess] = await Promise.all([
      userScheduleService.listAllWithSchedule(),
      reportAccessService.listUserAccess(),
    ]);
    const accessByUserId = new Map(withAccess.map((a) => [a.userId, a]));
    const data = withSchedule.map((u) => {
      const access = accessByUserId.get(u.userId);
      return {
        ...u,
        reportAccessGroupId: access ? access.groupId : null,
        reportAccessGroupName: access ? access.groupName : null,
      };
    });
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

async function updateReportAccess(req, res, next) {
  try {
    const { groupId } = req.body;
    await reportAccessService.setUserGroup(Number(req.params.userId), groupId ? Number(groupId) : null, req.user.username);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, updateSchedule, updateReportAccess };
