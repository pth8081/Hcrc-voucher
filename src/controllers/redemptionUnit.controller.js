const redemptionUnitService = require('../services/redemptionUnitService');

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
    res.status(201).json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    await redemptionUnitService.update(req.params.id, req.body);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update };
