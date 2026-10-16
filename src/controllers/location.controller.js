const locationService = require('../services/locationService');
const auditLogService = require('../services/auditLogService');

async function groups(req, res, next) {
  try {
    const data = await locationService.listGroups();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function details(req, res, next) {
  try {
    const data = await locationService.listDetails();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createDetail(req, res, next) {
  try {
    const locationName = (req.body.locationName || '').trim();
    if (!locationName) {
      return res.status(400).json({ success: false, message: 'Thieu ten dia diem (locationName)' });
    }
    const result = await locationService.createDetail(locationName);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'CREATE_LOCATION_DETAIL',
      targetUsername: locationName,
      detail: { before: null, after: { id: result.id, locationCode: result.locationCode, locationName } },
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { groups, details, createDetail };
