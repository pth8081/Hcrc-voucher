const partnerOverviewService = require('../services/partnerOverviewService');

async function list(req, res, next) {
  try {
    res.json({ success: true, data: await partnerOverviewService.listOverview() });
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
