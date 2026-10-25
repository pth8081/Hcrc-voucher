const partnerAdminService = require('../services/partnerAdminService');
const auditLogService = require('../services/auditLogService');
const scanLogService = require('../services/scanLogService');

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

/** Danh sach username trong PHAM VI cua partner-admin dang goi - chinh ho + moi tai khoan nhan
 * vien ho dang quan ly (xem partnerAdminService.js#listScopedUsers) - dung chung cho ca 2 ham
 * nhat ky quan tri ben duoi, doc TUOI tu CSDL moi lan goi (khong cache) de phan quyen luon dung
 * theo pham vi HIEN TAI, giong nguyen tac resolveScheduleScope() cua emailScheduleService.js. */
async function scopedUsernames(req) {
  const scoped = await partnerAdminService.listScopedUsers(req.partnerAdminConnectionId);
  return [...scoped.map((u) => u.username), req.user.username];
}

async function auditLog(req, res, next) {
  try {
    const usernames = await scopedUsernames(req);
    const data = await auditLogService.list({
      fromDate: req.query.fromDate || null,
      toDate: req.query.toDate || null,
      limit: req.query.limit,
      usernames,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function auditLogExport(req, res, next) {
  try {
    const usernames = await scopedUsernames(req);
    const fromDate = req.query.fromDate || null;
    const toDate = req.query.toDate || null;
    const rows = await auditLogService.list({ fromDate, toDate, limit: auditLogService.MAX_EXPORT_ROWS, usernames });
    const buffer = await auditLogService.buildExcelBuffer(rows);
    const fileName = `nhat-ky-quan-tri_${req.partnerAdminConnectionName}_${fromDate || 'toanbo'}_${toDate || 'toanbo'}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}

async function scanLog(req, res, next) {
  try {
    const data = await scanLogService.list({
      fromDate: req.query.fromDate || null,
      toDate: req.query.toDate || null,
      limit: req.query.limit,
      connectionName: req.partnerAdminConnectionName,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function scanLogExport(req, res, next) {
  try {
    const fromDate = req.query.fromDate || null;
    const toDate = req.query.toDate || null;
    const rows = await scanLogService.list({ fromDate, toDate, limit: scanLogService.MAX_EXPORT_ROWS, connectionName: req.partnerAdminConnectionName });
    const buffer = await scanLogService.buildExcelBuffer(rows);
    const fileName = `hoat-dong-quet-thu-hoi_${req.partnerAdminConnectionName}_${fromDate || 'toanbo'}_${toDate || 'toanbo'}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, setActive, auditLog, auditLogExport, scanLog, scanLogExport };
