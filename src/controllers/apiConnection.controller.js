const apiConnectionService = require('../services/apiConnectionService');
const { callDynamic } = require('../services/dynamicCoreApiClient');
const { generateTransNum } = require('../utils/transNum');

async function list(req, res, next) {
  try {
    res.json({ success: true, data: await apiConnectionService.list() });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const data = await apiConnectionService.getById(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Khong tim thay ket noi' });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getDefaults(req, res) {
  res.json({ success: true, data: apiConnectionService.getDefaults() });
}

function validateBody(body, res) {
  if (!body.name || !body.baseUrl || !body.checkPath || !body.redeemPath) {
    res.status(400).json({ success: false, message: 'Thieu name, baseUrl, checkPath hoac redeemPath' });
    return false;
  }
  return true;
}

async function create(req, res, next) {
  try {
    if (!validateBody(req.body, res)) return;
    const id = await apiConnectionService.create({ ...req.body, updatedBy: req.user.username });
    res.status(201).json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    if (!validateBody(req.body, res)) return;
    await apiConnectionService.update(req.params.id, { ...req.body, updatedBy: req.user.username });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function activate(req, res, next) {
  try {
    await apiConnectionService.activate(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await apiConnectionService.remove(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * Xac dinh cau hinh se dung de test, uu tien du lieu MOI NHAT tren form (de admin
 * test duoc ngay trong luc dang chinh sua, chua can bam Luu):
 * - Chi co `connection` (dang tao moi / chua luu): dung nguyen draft tu form.
 * - Chi co `connectionId`: dung dung cau hinh da luu (bao gom secret da giai ma).
 * - Ca hai: dang sua 1 ket noi da luu -> lay secret da luu lam nen, de cac truong
 *   secret tren form dang de trong (nghia la "giu nguyen"), nhung moi truong khac
 *   (path/method/mapping/body template...) luon lay theo gia tri MOI NHAT tren form.
 */
async function resolveTestConnection(req, res) {
  const overrides = req.body.connection ? apiConnectionService.resolveDraftConfig(req.body.connection) : null;

  if (req.body.connectionId) {
    const saved = await apiConnectionService.getByIdDecrypted(req.body.connectionId);
    if (!saved) {
      res.status(404).json({ success: false, message: 'Khong tim thay ket noi da luu' });
      return null;
    }
    if (!overrides) return saved;

    const merged = { ...saved, ...overrides, id: saved.id };
    if (!req.body.connection.authToken) merged.authToken = saved.authToken;
    if (!req.body.connection.basicPassword) merged.basicPassword = saved.basicPassword;
    return merged;
  }

  if (overrides) return overrides;

  res.status(400).json({ success: false, message: 'Thieu connectionId hoac connection (cau hinh nhap tren form)' });
  return null;
}

/** Test kiem tra voucher (an toan - chi doc, khong lam thay doi trang thai voucher that). */
async function testCheck(req, res, next) {
  try {
    const voucherCode = (req.body.voucherCode || '').trim();
    if (!voucherCode) return res.status(400).json({ success: false, message: 'Thieu voucherCode de test' });

    const connection = await resolveTestConnection(req, res);
    if (!connection) return;

    try {
      const result = await callDynamic(connection, 'check', { code: voucherCode });
      await apiConnectionService.logTest({
        connectionId: connection.id,
        action: 'CHECK',
        voucherCode,
        requestUrl: result.requestUrl,
        httpStatus: result.httpStatus,
        latencyMs: result.latencyMs,
        success: true,
        rawResponse: result.raw,
        normalizedResult: result.normalized,
        testedBy: req.user.username,
      });
      res.json({ success: true, data: result });
    } catch (callErr) {
      await apiConnectionService.logTest({
        connectionId: connection.id,
        action: 'CHECK',
        voucherCode,
        requestUrl: callErr.requestUrl,
        latencyMs: callErr.latencyMs,
        success: false,
        errorMessage: callErr.message,
        testedBy: req.user.username,
      });
      res.status(502).json({ success: false, message: `Goi Core API that bai: ${callErr.message}`, requestUrl: callErr.requestUrl });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Test THU HOI voucher that (se lam thay doi trang thai voucher tren Core system that su).
 * Bat buoc client gui confirmRedeem = true de tranh bam nham lam mat voucher that cua doi tac/khach hang.
 */
async function testRedeem(req, res, next) {
  try {
    const voucherCode = (req.body.voucherCode || '').trim();
    if (!voucherCode) return res.status(400).json({ success: false, message: 'Thieu voucherCode de test' });
    if (req.body.confirmRedeem !== true) {
      return res.status(400).json({
        success: false,
        message: 'Test thu hoi se tieu voucher THAT tren he thong Core. Gui confirmRedeem = true de xac nhan.',
      });
    }

    const connection = await resolveTestConnection(req, res);
    if (!connection) return;

    const transNum = generateTransNum();
    const vars = {
      code: voucherCode,
      username: req.user.username,
      locationsGroup: req.user.locationsGroup || '',
      locationsDetail: req.user.locationsDetail || '',
      transNum,
    };

    try {
      const result = await callDynamic(connection, 'redeem', vars);
      await apiConnectionService.logTest({
        connectionId: connection.id,
        action: 'REDEEM',
        voucherCode,
        requestUrl: result.requestUrl,
        httpStatus: result.httpStatus,
        latencyMs: result.latencyMs,
        success: true,
        rawResponse: result.raw,
        normalizedResult: result.normalized,
        testedBy: req.user.username,
      });
      res.json({ success: true, data: result });
    } catch (callErr) {
      await apiConnectionService.logTest({
        connectionId: connection.id,
        action: 'REDEEM',
        voucherCode,
        requestUrl: callErr.requestUrl,
        latencyMs: callErr.latencyMs,
        success: false,
        errorMessage: callErr.message,
        testedBy: req.user.username,
      });
      res.status(502).json({ success: false, message: `Goi Core API that bai: ${callErr.message}`, requestUrl: callErr.requestUrl });
    }
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, getDefaults, create, update, activate, remove, testCheck, testRedeem };
