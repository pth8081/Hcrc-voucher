const emailScheduleService = require('../services/emailScheduleService');
const permissionService = require('../services/permissionService');
const auditLogService = require('../services/auditLogService');

const REPORT_TYPE_PERMISSION = {
  DAILY: 'canViewReconciliation',
  SUMMARY: 'canViewSummary',
  USED_VOUCHERS: 'canViewUsedVouchers',
};

function forbiddenReportType() {
  const err = new Error('Tai khoan cua ban khong co quyen xem loai bao cao nay');
  err.statusCode = 403;
  err.publicMessage = err.message;
  return err;
}

/** Tai khoan chi duoc len lich gui email cho DUNG loai bao cao ma chinh ho co quyen XEM (giong
 * het dieu kien da ap dung cho man hinh bao cao tuong ung) - tranh 1 tai khoan chi duoc cap quyen
 * xem "Doi soat" lai tu y gui duoc email "Tong hop" ma ho khong duoc xem qua man hinh thuong.
 *
 * sql/052: "Doi soat cheo Core" la nang luc MOI, KHONG tu dong co san cho tai khoan Quan tri day
 * du (khac 3 loai con lai - role=1 LUON co du ca 3 nen bypass som o tren) - phai kiem tra quyen
 * rieng AdminCanReconcileCore/PartnerAdminCanReconcileCore, cung mau voi requireReconcileCoreAccess.js. */
async function assertCanUseReportType(req, reportType) {
  if (reportType === 'CORE_RECONCILIATION') {
    if (Number(req.user.role) === 1) {
      const perms = await permissionService.getAdminFeaturePermissions(req.user.userId);
      if (!perms.adminCanReconcileCore) throw forbiddenReportType();
      return;
    }
    const permissions = await permissionService.getPermissions(req.user.userId);
    if (!permissions.isPartnerAdmin || !permissions.partnerAdminCanReconcileCore) throw forbiddenReportType();
    return;
  }
  if (Number(req.user.role) === 1) return;
  const flag = REPORT_TYPE_PERMISSION[reportType];
  const permissions = await permissionService.getPermissions(req.user.userId);
  if (!flag || !permissions[flag]) throw forbiddenReportType();
}

async function list(req, res, next) {
  try {
    const data = await emailScheduleService.listSchedules({ userId: req.user.userId, role: req.user.role });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** v3.100: danh sach tai khoan co san Email, dung lam goi y tich chon nhanh o o "Nguoi nhan" -
 * xem emailScheduleService.js#listRecipientCandidates. */
async function listRecipients(req, res, next) {
  try {
    const data = await emailScheduleService.listRecipientCandidates({ userId: req.user.userId, role: req.user.role });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    await assertCanUseReportType(req, req.body.reportType);
    const created = await emailScheduleService.createSchedule(req.body, req.user);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'CREATE_EMAIL_SCHEDULE',
      targetUsername: req.body.name,
      detail: { before: null, after: { reportType: req.body.reportType, frequency: req.body.frequency } },
    });
    res.json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    await assertCanUseReportType(req, req.body.reportType);
    await emailScheduleService.updateSchedule(id, req.body, { userId: req.user.userId, role: req.user.role });
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_EMAIL_SCHEDULE',
      targetUsername: req.body.name,
      detail: { before: null, after: { reportType: req.body.reportType, frequency: req.body.frequency } },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function setEnabled(req, res, next) {
  try {
    const id = Number(req.params.id);
    const isEnabled = !!req.body.isEnabled;
    await emailScheduleService.setEnabled(id, isEnabled, { userId: req.user.userId, role: req.user.role });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    await emailScheduleService.removeSchedule(id, { userId: req.user.userId, role: req.user.role });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function sendNow(req, res, next) {
  try {
    const id = Number(req.params.id);
    const row = await emailScheduleService.assertOwnership(id, { userId: req.user.userId, role: req.user.role });
    try {
      await emailScheduleService.sendScheduleNow(row);
      await emailScheduleService.markSent(id, 'SUCCESS', null);
    } catch (err) {
      await emailScheduleService.markSent(id, 'FAILED', err.publicMessage || err.message);
      throw err;
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, listRecipients, create, update, setEnabled, remove, sendNow };
