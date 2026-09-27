const partnerApiKeyService = require('../services/partnerApiKeyService');
const auditLogService = require('../services/auditLogService');

async function list(req, res, next) {
  try {
    res.json({ success: true, data: await partnerApiKeyService.list() });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { userId, label, canCheck, canRedeem } = req.body;
    const result = await partnerApiKeyService.create({
      userId,
      label,
      canCheck,
      canRedeem,
      createdByUsername: req.user.username,
    });
    // L6: KHONG BAO GIO ghi API key (du la ban ro hay hash) vao audit log - chi ghi thong tin
    // khong nhay cam (label, tai khoan gan voi key) de biet duoc "key nao, cho ai" ma khong lo
    // ro ri neu bang AdminAuditLog bi doc trai phep.
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'CREATE_PARTNER_API_KEY',
      targetUsername: String(userId),
      detail: { before: null, after: { id: result.id, label, keyPrefix: result.keyPrefix, canCheck: canCheck !== false, canRedeem: canRedeem !== false } },
    });
    // Key that (result.apiKey) CHI xuat hien trong response nay 1 LAN DUY NHAT - server khong
    // luu ban ro nen khong the lay lai sau, dung y het nguyen tac hien cua ApiConnections/mat khau.
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function revoke(req, res, next) {
  try {
    await partnerApiKeyService.revoke(req.params.id, req.user.username);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'REVOKE_PARTNER_API_KEY',
      targetUsername: String(req.params.id),
      detail: { before: { id: req.params.id }, after: { revoked: true } },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, revoke };
