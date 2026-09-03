const locationService = require('../services/locationService');

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

module.exports = { groups, details };
