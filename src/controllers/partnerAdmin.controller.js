const partnerAdminService = require('../services/partnerAdminService');
const auditLogService = require('../services/auditLogService');

async function list(req, res, next) {
  try {
    const data = await partnerAdminService.listScopedUsers(req.partnerAdminConnectionId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { username, password, fullName } = req.body;
    const created = await partnerAdminService.createScopedUser(
      { username, password, fullName },
      req.partnerAdminConnectionId,
      req.user.username
    );
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'PARTNER_ADMIN_CREATE_USER',
      targetUsername: created.username,
      detail: { before: null, after: { connectionName: req.partnerAdminConnectionName } },
    });
    res.json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
}

async function setActive(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    // M4 (tai su dung cung ly do nhu user.controller.js#updateDeleteStatus): khong cho tu khoa
    // chinh tai khoan dang dang nhap - tranh partner-admin vo tinh tu khoa minh, khong ai trong
    // pham vi ho con dang nhap duoc de mo lai (phai nho admin HCRC can thiep).
    const { isDeleted, username } = req.body;
    if (isDeleted && userId === req.user.userId) {
      return res.status(400).json({ success: false, message: 'Khong the tu khoa chinh tai khoan dang dang nhap' });
    }
    await partnerAdminService.setScopedUserActive(userId, req.partnerAdminConnectionId, !!isDeleted, req.user.username);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: isDeleted ? 'PARTNER_ADMIN_LOCK_USER' : 'PARTNER_ADMIN_UNLOCK_USER',
      targetUsername: username || String(userId),
      detail: { before: null, after: { isDeleted: !!isDeleted } },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, setActive };
