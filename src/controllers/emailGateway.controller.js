const emailGatewayService = require('../services/emailGatewayService');
const auditLogService = require('../services/auditLogService');

async function getConfig(req, res, next) {
  try {
    const data = await emailGatewayService.getMaskedConfig();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function saveConfig(req, res, next) {
  try {
    const before = await emailGatewayService.getMaskedConfig();
    await emailGatewayService.saveConfig(req.body, req.user.username);
    const after = await emailGatewayService.getMaskedConfig();
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_EMAIL_GATEWAY',
      targetUsername: after ? after.host : null,
      // Khong ghi mat khau (ca cu lan moi) vao audit log - giong quy uoc cua apiConnectionService.js.
      detail: { before, after },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function sendTest(req, res, next) {
  try {
    await emailGatewayService.sendTestEmail(req.body.toEmail);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { getConfig, saveConfig, sendTest };
