const reportAccessService = require('../services/reportAccessService');
const auditLogService = require('../services/auditLogService');

async function list(req, res, next) {
  try {
    const data = await reportAccessService.listGroups();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

function validate(body) {
  const { groupName, scopeType, companyIds } = body;
  if (!groupName || !['ALL', 'SPECIFIC'].includes(scopeType)) {
    return 'Thieu groupName hoac scopeType khong hop le (phai la ALL hoac SPECIFIC)';
  }
  if (scopeType === 'SPECIFIC' && (!Array.isArray(companyIds) || !companyIds.length)) {
    return 'Nhom pham vi SPECIFIC phai chon it nhat 1 cong ty';
  }
  return null;
}

async function create(req, res, next) {
  try {
    const error = validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const id = await reportAccessService.createGroup(req.body);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'CREATE_ACCESS_GROUP',
      targetUsername: req.body.groupName,
      detail: { before: null, after: { id, scopeType: req.body.scopeType, companyIds: req.body.companyIds } },
    });
    res.status(201).json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const error = validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const groupId = Number(req.params.id);
    // L6: lay trang thai TRUOC KHI sua de ghi vao audit log (xem ghi chu chi tiet o auditLogService.js).
    const before = await reportAccessService.getGroupById(groupId);
    await reportAccessService.updateGroup(groupId, req.body);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_ACCESS_GROUP',
      targetUsername: req.body.groupName || String(req.params.id),
      detail: {
        before: before ? { groupName: before.groupName, scopeType: before.scopeType, companyIds: before.companyIds } : null,
        after: { id: req.params.id, scopeType: req.body.scopeType, companyIds: req.body.companyIds },
      },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update };
