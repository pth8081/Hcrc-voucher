const redemptionUnitService = require('../services/redemptionUnitService');
const auditLogService = require('../services/auditLogService');

async function list(req, res, next) {
  try {
    const data = await redemptionUnitService.list();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { locationDetailId, companyId, partnerCode, partnerName } = req.body;
    if (!locationDetailId || !companyId || !partnerCode || !partnerName) {
      return res
        .status(400)
        .json({ success: false, message: 'Thieu locationDetailId, companyId, partnerCode hoac partnerName' });
    }
    const id = await redemptionUnitService.create(req.body);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'CREATE_REDEMPTION_UNIT',
      targetUsername: partnerName,
      detail: { before: null, after: { id, partnerCode, companyId, locationDetailId } },
    });
    res.status(201).json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const unitId = Number(req.params.id);
    // L6: lay trang thai TRUOC KHI sua de ghi vao audit log (xem ghi chu chi tiet o auditLogService.js).
    const before = await redemptionUnitService.getById(unitId);
    await redemptionUnitService.update(unitId, req.body);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_REDEMPTION_UNIT',
      targetUsername: req.body.partnerName || String(req.params.id),
      detail: {
        before: before ? { partnerCode: before.PartnerCode, companyId: before.CompanyId, status: before.Status } : null,
        after: { id: req.params.id, partnerCode: req.body.partnerCode, companyId: req.body.companyId, status: req.body.status },
      },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update };
