const userScheduleService = require('../services/userScheduleService');
const reportAccessService = require('../services/reportAccessService');
const permissionService = require('../services/permissionService');
const userAdminService = require('../services/userAdminService');
const redemptionUnitService = require('../services/redemptionUnitService');
const auditLogService = require('../services/auditLogService');
const authService = require('../services/authService');
const sessionRevalidation = require('../utils/sessionRevalidation');

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
      detail: {
        before: null,
        after: { role: Number(role) === 1 ? 'admin' : 'staff', redemptionUnitId: redemptionUnitId || null, locationsDetail },
      },
    });
    res.json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
}

async function updateLocation(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    // L6: authService.findUserById() vua kiem tra ton tai (tra ve null neu khong co) VUA lay
    // luon trang thai TRUOC KHI sua de ghi vao audit log (xem ghi chu chi tiet o auditLogService.js).
    const before = await authService.findUserById(userId);
    if (!before) {
      const err = new Error('Khong tim thay tai khoan nay');
      err.statusCode = 400;
      err.publicMessage = 'Khong tim thay tai khoan nay (co the da bi xoa hoac id khong dung)';
      throw err;
    }
    const { redemptionUnitId, username } = req.body;
    const locationsDetail = await resolveLocationsDetail({ redemptionUnitId, locationsDetail: null });
    await userAdminService.updateLocation(userId, locationsDetail);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_USER_LOCATION',
      targetUsername: username || String(req.params.userId),
      detail: {
        before: { locationsDetail: before.Locations_Detail },
        after: { redemptionUnitId: redemptionUnitId || null, locationsDetail },
      },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const before = await authService.findUserById(userId);
    if (!before) {
      const err = new Error('Khong tim thay tai khoan nay');
      err.statusCode = 400;
      err.publicMessage = 'Khong tim thay tai khoan nay (co the da bi xoa hoac id khong dung)';
      throw err;
    }
    const { fullName, password, username } = req.body;
    await userAdminService.updateProfile(userId, { fullName, password });
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_USER_PROFILE',
      targetUsername: username || String(req.params.userId),
      // L6: KHONG BAO GIO ghi mat khau (ca cu lan moi, du la hash) vao audit log - chi ghi CO
      // doi hay khong, giu nguyen hanh vi cu cho truong nay, chi them before/after cho ho ten.
      detail: {
        before: { fullName: before.FullName },
        after: { fullName: fullName != null ? String(fullName).trim() : before.FullName, passwordReset: !!password },
      },
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
    await userAdminService.assertUserExists(userId);
    const beforeSchedule = await userScheduleService.getSchedule(userId);
    await userScheduleService.setDeleted(userId, !!isDeleted, req.user.username);
    sessionRevalidation.invalidate(userId); // H1: co hieu luc ngay, khong cho token cu qua 30s cache
    await auditLogService.log({
      actorUsername: req.user.username,
      action: isDeleted ? 'DELETE_USER' : 'RESTORE_USER',
      targetUsername: username || String(userId),
      detail: {
        before: { isDeleted: !!(beforeSchedule && beforeSchedule.IsDeleted) },
        after: { isDeleted: !!isDeleted },
      },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updatePermissions(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    await userAdminService.assertUserExists(userId);
    const before = await permissionService.getPermissions(userId);
    const { canRedeemVoucher, canViewReconciliation, canViewSummary, canViewUsedVouchers } = req.body;
    const perms = {
      canRedeemVoucher: !!canRedeemVoucher,
      canViewReconciliation: !!canViewReconciliation,
      canViewSummary: !!canViewSummary,
      canViewUsedVouchers: !!canViewUsedVouchers,
    };
    await permissionService.setPermissions(userId, perms, req.user.username);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_PERMISSIONS',
      targetUsername: req.body.username || String(req.params.userId),
      detail: { before, after: perms },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updateSchedule(req, res, next) {
  try {
    const { activeFrom, activeUntil, username } = req.body;
    const userId = Number(req.params.userId);
    if (activeFrom && activeUntil && new Date(activeFrom) > new Date(activeUntil)) {
      return res.status(400).json({ success: false, message: 'Thoi gian kich hoat phai truoc thoi gian het han' });
    }
    // M4: nut "Khoa" tren giao dien (users.js#toggleLockFields) chi dien san gia tri vao 2 o
    // Kich hoat tu/Het han cua CHINH endpoint nay - khac voi nut "Xoa" (updateDeleteStatus) da co
    // check tu bao ve, endpoint nay truoc day KHONG co, 1 admin co the vo tinh (hoac bi du) tu
    // dat lich khoa chinh minh, khong ai khac dang nhap duoc de mo lai (phai nho DBA can thiep
    // thang vao CSDL).
    if (userId === req.user.userId) {
      const newState = userScheduleService.evaluate({ ActiveFrom: activeFrom, ActiveUntil: activeUntil }).state;
      if (newState !== 'active') {
        return res.status(400).json({ success: false, message: 'Khong the tu dat lich lam khoa chinh tai khoan dang dang nhap' });
      }
    }
    await userAdminService.assertUserExists(userId);
    const beforeSchedule = await userScheduleService.getSchedule(userId);
    await userScheduleService.upsertSchedule(userId, { activeFrom, activeUntil }, req.user.username);
    sessionRevalidation.invalidate(userId); // H1: khoa/mo khoa co hieu luc ngay
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_SCHEDULE',
      targetUsername: username || String(req.params.userId),
      detail: {
        before: { activeFrom: beforeSchedule && beforeSchedule.ActiveFrom, activeUntil: beforeSchedule && beforeSchedule.ActiveUntil },
        after: { activeFrom, activeUntil },
      },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updateReportAccess(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    await userAdminService.assertUserExists(userId);
    const before = await reportAccessService.getUserGroup(userId);
    const { groupId, username } = req.body;
    await reportAccessService.setUserGroup(userId, groupId ? Number(groupId) : null, req.user.username);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_REPORT_ACCESS',
      targetUsername: username || String(req.params.userId),
      detail: { before: { groupId: before ? before.groupId : null }, after: { groupId: groupId || null } },
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
