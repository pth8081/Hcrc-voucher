const webauthnService = require('../services/webauthnService');

async function registerOptions(req, res, next) {
  try {
    const { options, flowId } = await webauthnService.getRegistrationOptions(req.user);
    res.json({ success: true, data: { options, flowId } });
  } catch (err) {
    next(err);
  }
}

async function registerVerify(req, res, next) {
  try {
    const { flowId, response, deviceLabel } = req.body;
    if (!flowId || !response) {
      return res.status(400).json({ success: false, message: 'Thieu flowId hoac response' });
    }
    const result = await webauthnService.verifyRegistration({
      flowId,
      response,
      deviceLabel,
      userId: req.user.userId,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function authOptions(req, res, next) {
  try {
    const { options, flowId } = await webauthnService.getAuthenticationOptions();
    res.json({ success: true, data: { options, flowId } });
  } catch (err) {
    next(err);
  }
}

async function authVerify(req, res, next) {
  try {
    const { flowId, response } = req.body;
    if (!flowId || !response) {
      return res.status(400).json({ success: false, message: 'Thieu flowId hoac response' });
    }
    const result = await webauthnService.verifyAuthentication({ flowId, response });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function listDevices(req, res, next) {
  try {
    const data = await webauthnService.listCredentialsByUser(req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function removeDevice(req, res, next) {
  try {
    await webauthnService.deleteCredential(req.user.userId, req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { registerOptions, registerVerify, authOptions, authVerify, listDevices, removeDevice };
