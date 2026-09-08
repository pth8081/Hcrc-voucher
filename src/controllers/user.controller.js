const userScheduleService = require('../services/userScheduleService');
const reportAccessService = require('../services/reportAccessService');
const permissionService = require('../services/permissionService');
const userAdminService = require('../services/userAdminService');
const auditLogService = require('../services/auditLogService');

async function list(req, res, next) {
  try {
    const [withSchedule, withAccess] = await Promise.all([
      userScheduleService.listAllWithSchedule(),
      reportAccessService.listUserAccess(),
    ]);
    const accessByUserId = new Map(withAccess.map((a) => [a.userId, a]));
    const data = await Promise.all(
      withSchedule.map(async (u) => {
        const access = accessByUserId.get(u.userId);
        const permissions = await permissionService.resolvePermissions({ userId: u.userId, role: u.role });
        return {
          ...u,
          reportAccessGroupId: access ? access.groupId : null,
          reportAccessGroupName: access ? access.groupName : null,
          permissions,
        };
      })
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { username, password, fullName, locationsGroup, locationsDetail, role } = req.body;
    const created = await userAdminService.createUser(
      { username, password, fullName, locationsGroup, locationsDetail, role },
      req.user.username
    );
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'CREATE_USER',
      targetUsername: created.username,
      detail: { role: Number(role) === 1 ? 'admin' : 'staff', locationsGroup, locationsDetail },
    });
    res.json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
}

async function updatePermissions(req, res, next) {
  try {
    const { canRedeemVoucher, canViewReconciliation, canViewSummary, canViewUsedVouchers } = req.body;
    const perms = {
      canRedeemVoucher: !!canRedeemVoucher,
      canViewReconciliation: !!canViewReconciliation,
      canViewSummary: !!canViewSummary,
      canViewUsedVouchers: !!canViewUsedVouchers,
    };
    await permissionService.setPermissions(Number(req.params.userId), perms, req.user.username);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_PERMISSIONS',
      targetUsername: req.body.username || String(req.params.userId),
      detail: perms,
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updateSchedule(req, res, next) {
  try {
    const { activeFrom, activeUntil, username } = req.body;
    if (activeFrom && activeUntil && new Date(activeFrom) > new Date(activeUntil)) {
      return res.status(400).json({ success: false, message: 'Thoi gian kich hoat phai truoc thoi gian het han' });
    }
    await userScheduleService.upsertSchedule(Number(req.params.userId), { activeFrom, activeUntil }, req.user.username);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_SCHEDULE',
      targetUsername: username || String(req.params.userId),
      detail: { activeFrom, activeUntil },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updateReportAccess(req, res, next) {
  try {
    const { groupId, username } = req.body;
    await reportAccessService.setUserGroup(Number(req.params.userId), groupId ? Number(groupId) : null, req.user.username);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_REPORT_ACCESS',
      targetUsername: username || String(req.params.userId),
      detail: { groupId: groupId || null },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, updatePermissions, updateSchedule, updateReportAccess };
