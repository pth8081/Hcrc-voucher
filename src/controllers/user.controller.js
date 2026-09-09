const userScheduleService = require('../services/userScheduleService');
const reportAccessService = require('../services/reportAccessService');
const permissionService = require('../services/permissionService');
const userAdminService = require('../services/userAdminService');
const redemptionUnitService = require('../services/redemptionUnitService');
const auditLogService = require('../services/auditLogService');

/** redemptionUnitId (neu co) luon uu tien - tra ve LocationCode that cua Don vi thu hoi da
 * chon, thay the moi gia tri locationsDetail go tay. Nem loi 400 neu chon 1 id khong ton tai. */
async function resolveLocationsDetail({ redemptionUnitId, locationsDetail }) {
  if (!redemptionUnitId) return locationsDetail || null;
  const code = await redemptionUnitService.getLocationCodeById(Number(redemptionUnitId));
  if (!code) {
    const err = new Error('Khong tim thay Don vi thu hoi da chon');
    err.statusCode = 400;
    err.publicMessage = 'Don vi thu hoi da chon khong ton tai, vui long chon lai';
    throw err;
  }
  return code;
}

async function list(req, res, next) {
  try {
    const includeDeleted = req.query.includeDeleted === 'true';
    const [withSchedule, withAccess] = await Promise.all([
      userScheduleService.listAllWithSchedule(includeDeleted),
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
    const { username, password, fullName, locationsGroup, redemptionUnitId, role } = req.body;
    const locationsDetail = await resolveLocationsDetail({ redemptionUnitId, locationsDetail: req.body.locationsDetail });
    const created = await userAdminService.createUser(
      { username, password, fullName, locationsGroup, locationsDetail, role },
      req.user.username
    );
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'CREATE_USER',
      targetUsername: created.username,
      detail: { role: Number(role) === 1 ? 'admin' : 'staff', redemptionUnitId: redemptionUnitId || null, locationsDetail },
    });
    res.json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
}

async function updateLocation(req, res, next) {
  try {
    const { redemptionUnitId, username } = req.body;
    const locationsDetail = await resolveLocationsDetail({ redemptionUnitId, locationsDetail: null });
    await userAdminService.updateLocation(Number(req.params.userId), locationsDetail);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_USER_LOCATION',
      targetUsername: username || String(req.params.userId),
      detail: { redemptionUnitId: redemptionUnitId || null, locationsDetail },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { fullName, password, username } = req.body;
    await userAdminService.updateProfile(Number(req.params.userId), { fullName, password });
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_USER_PROFILE',
      targetUsername: username || String(req.params.userId),
      detail: { fullNameChanged: fullName != null, passwordReset: !!password },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updateDeleteStatus(req, res, next) {
  try {
    const { isDeleted, username } = req.body;
    const userId = Number(req.params.userId);
    if (isDeleted && userId === req.user.userId) {
      return res.status(400).json({ success: false, message: 'Khong the tu xoa chinh tai khoan dang dang nhap' });
    }
    await userScheduleService.setDeleted(userId, !!isDeleted, req.user.username);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: isDeleted ? 'DELETE_USER' : 'RESTORE_USER',
      targetUsername: username || String(userId),
      detail: { isDeleted: !!isDeleted },
    });
    res.json({ success: true });
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

module.exports = {
  list,
  create,
  updatePermissions,
  updateSchedule,
  updateReportAccess,
  updateLocation,
  updateProfile,
  updateDeleteStatus,
};
