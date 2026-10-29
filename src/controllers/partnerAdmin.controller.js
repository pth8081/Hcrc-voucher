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
    const { username, password, fullName, redemptionUnitId, companyId, email, phone } = req.body;
    const created = await partnerAdminService.createScopedUser(
      { username, password, fullName, redemptionUnitId, companyId, email, phone },
      req.partnerAdminConnectionId,
      req.user.username
    );
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'PARTNER_ADMIN_CREATE_USER',
      targetUsername: created.username,
      detail: { before: null, after: { connectionName: req.partnerAdminConnectionName, redemptionUnitId: redemptionUnitId || null, companyId: companyId || null } },
    });
    res.json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
}

/**
 * v3.94 (xem sql/043): gan/doi "Cong ty" + bat/tat "Tai khoan doi tac" cho 1 tai khoan DA THUOC
 * pham vi cua doi tac nay.
 */
async function updateUserCompany(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const { companyId, isPartnerAccount, username } = req.body;
    await partnerAdminService.updateScopedUserCompany(userId, req.partnerAdminConnectionId, { companyId, isPartnerAccount }, req.user.username);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'PARTNER_ADMIN_UPDATE_USER_COMPANY',
      targetUsername: username || String(userId),
      detail: { before: null, after: { companyId: companyId || null, isPartnerAccount: !!isPartnerAccount } },
    });
    res.json({ success: true });
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

async function removeOwnConnection(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const { username } = req.body;
    await partnerAdminService.removeOwnConnection(userId, req.partnerAdminConnectionId);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'PARTNER_ADMIN_REMOVE_OWN_CONNECTION',
      targetUsername: username || String(userId),
      detail: { before: null, after: { removedConnectionId: req.partnerAdminConnectionId, removedConnectionName: req.partnerAdminConnectionName } },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updateUserProfile(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const { fullName, password, username, email, phone } = req.body;
    await partnerAdminService.updateScopedUserProfile(userId, req.partnerAdminConnectionId, { fullName, password, email, phone }, req.user.username);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'PARTNER_ADMIN_UPDATE_PROFILE',
      targetUsername: username || String(userId),
      // L6: KHONG ghi mat khau vao audit log, chi ghi co doi hay khong - giong user.controller.js#updateProfile.
      detail: { before: null, after: { fullName: fullName != null ? String(fullName).trim() : undefined, passwordReset: !!password } },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updateUserPermissions(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const { username } = req.body;
    const safePerms = await partnerAdminService.updateScopedUserPermissions(userId, req.partnerAdminConnectionId, req.body, req.user.username);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'PARTNER_ADMIN_UPDATE_PERMISSIONS',
      targetUsername: username || String(userId),
      detail: { before: null, after: safePerms },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updateUserLocation(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const { redemptionUnitId, username } = req.body;
    await partnerAdminService.updateScopedUserLocation(userId, req.partnerAdminConnectionId, redemptionUnitId ? Number(redemptionUnitId) : null);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'PARTNER_ADMIN_UPDATE_LOCATION',
      targetUsername: username || String(userId),
      detail: { before: null, after: { redemptionUnitId: redemptionUnitId || null } },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updateUserReportAccessGroup(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const { reportAccessGroupId, username } = req.body;
    await partnerAdminService.updateScopedUserReportAccessGroup(
      userId,
      req.partnerAdminConnectionId,
      reportAccessGroupId ? Number(reportAccessGroupId) : null,
      req.user.username
    );
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'PARTNER_ADMIN_UPDATE_REPORT_ACCESS_GROUP',
      targetUsername: username || String(userId),
      detail: { before: null, after: { reportAccessGroupId: reportAccessGroupId || null } },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function listCompanies(req, res, next) {
  try {
    const data = await partnerAdminService.listOwnCompanies(req.partnerAdminConnectionId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// v3.97: doi tac khong con tu chon duoc companyType nua (xem partnerAdminService.js#createOwnCompany/
// updateOwnCompany) - bo luon khoi detail audit log de khong ghi nham thong tin KHONG thuc su duoc
// ap dung (truoc day log theo dung gia tri client gui len, du server co the da bo qua no).
async function createCompany(req, res, next) {
  try {
    const { companyCode, companyName, address } = req.body;
    const id = await partnerAdminService.createOwnCompany({ companyCode, companyName, address }, req.partnerAdminConnectionId);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'PARTNER_ADMIN_CREATE_COMPANY',
      targetUsername: companyName,
      detail: { before: null, after: { id, companyCode } },
    });
    res.status(201).json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
}

async function updateCompany(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { companyCode, companyName, address } = req.body;
    await partnerAdminService.updateOwnCompany(id, { companyCode, companyName, address }, req.partnerAdminConnectionId, req.user.username);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'PARTNER_ADMIN_UPDATE_COMPANY',
      targetUsername: companyName,
      detail: { before: null, after: { id, companyCode } },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/** Xem truoc so Diem tieu/tai khoan se bi anh huong NEU chuyen 1 cong ty cua doi tac nay sang
 * "Cong ty doi tac" - dung cho hop thoai xac nhan o partner-admin.js. */
async function companyConvertPreview(req, res, next) {
  try {
    const id = Number(req.params.id);
    const preview = await partnerAdminService.getOwnCompanyConvertPreview(id, req.partnerAdminConnectionId);
    res.json({ success: true, data: preview });
  } catch (err) {
    next(err);
  }
}

async function removeCompany(req, res, next) {
  try {
    const id = Number(req.params.id);
    await partnerAdminService.removeOwnCompany(id, req.partnerAdminConnectionId);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'PARTNER_ADMIN_DELETE_COMPANY',
      targetUsername: String(id),
      detail: { before: null, after: null },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function listUnits(req, res, next) {
  try {
    const data = await partnerAdminService.listOwnUnits(req.partnerAdminConnectionId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createUnit(req, res, next) {
  try {
    const { locationName, companyId, address } = req.body;
    const created = await partnerAdminService.createOwnUnit({ locationName, companyId, address }, req.partnerAdminConnectionId);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'PARTNER_ADMIN_CREATE_UNIT',
      targetUsername: locationName,
      detail: { before: null, after: created },
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
}

async function updateUnit(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { locationName, companyId, address } = req.body;
    await partnerAdminService.updateOwnUnit(id, { locationName, companyId, address }, req.partnerAdminConnectionId);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'PARTNER_ADMIN_UPDATE_UNIT',
      targetUsername: locationName,
      detail: { before: null, after: { id, companyId: companyId || null } },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function removeUnit(req, res, next) {
  try {
    const id = Number(req.params.id);
    await partnerAdminService.removeOwnUnit(id, req.partnerAdminConnectionId);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'PARTNER_ADMIN_DELETE_UNIT',
      targetUsername: String(id),
      detail: { before: null, after: null },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

function validateGroupBody(body) {
  const { groupName, scopeType, companyIds } = body;
  if (!groupName || !['ALL', 'SPECIFIC'].includes(scopeType)) {
    return 'Thieu groupName hoac scopeType khong hop le (phai la ALL hoac SPECIFIC)';
  }
  if (scopeType === 'SPECIFIC' && (!Array.isArray(companyIds) || !companyIds.length)) {
    return 'Nhom pham vi SPECIFIC phai chon it nhat 1 cong ty';
  }
  return null;
}

async function listReportAccessGroups(req, res, next) {
  try {
    const data = await partnerAdminService.listOwnReportAccessGroups(req.partnerAdminConnectionId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createReportAccessGroup(req, res, next) {
  try {
    const error = validateGroupBody(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const id = await partnerAdminService.createOwnReportAccessGroup(req.body, req.partnerAdminConnectionId);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'PARTNER_ADMIN_CREATE_ACCESS_GROUP',
      targetUsername: req.body.groupName,
      detail: { before: null, after: { id, scopeType: req.body.scopeType, companyIds: req.body.companyIds } },
    });
    res.status(201).json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
}

async function updateReportAccessGroup(req, res, next) {
  try {
    const error = validateGroupBody(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const id = Number(req.params.id);
    await partnerAdminService.updateOwnReportAccessGroup(id, req.body, req.partnerAdminConnectionId);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'PARTNER_ADMIN_UPDATE_ACCESS_GROUP',
      targetUsername: req.body.groupName,
      detail: { before: null, after: { id, scopeType: req.body.scopeType, companyIds: req.body.companyIds } },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function removeReportAccessGroup(req, res, next) {
  try {
    const id = Number(req.params.id);
    await partnerAdminService.removeOwnReportAccessGroup(id, req.partnerAdminConnectionId);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'PARTNER_ADMIN_DELETE_ACCESS_GROUP',
      targetUsername: String(id),
      detail: { before: null, after: null },
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

module.exports = {
  list,
  create,
  setActive,
  removeOwnConnection,
  updateUserProfile,
  updateUserPermissions,
  updateUserLocation,
  updateUserReportAccessGroup,
  updateUserCompany,
  listCompanies,
  createCompany,
  updateCompany,
  removeCompany,
  companyConvertPreview,
  listUnits,
  createUnit,
  updateUnit,
  removeUnit,
  listReportAccessGroups,
  createReportAccessGroup,
  updateReportAccessGroup,
  removeReportAccessGroup,
  auditLog,
  auditLogExport,
  scanLog,
  scanLogExport,
};
