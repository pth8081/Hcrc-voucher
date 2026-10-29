const apiConnectionService = require('../services/apiConnectionService');
const auditLogService = require('../services/auditLogService');

/** Danh sach he thong nguoi dung hien tai duoc phep xem/sua - HCRC (scope='all') thay het, Quan
 * tri doi tac (scope='own') CHI thay dung 1 he thong da gan (req.voucherFilterConnectionId). */
async function list(req, res, next) {
  try {
    const all = await apiConnectionService.listPrefixFilterOnly();
    const data = req.voucherFilterScope === 'all'
      ? all
      : all.filter((c) => Number(c.id) === Number(req.voucherFilterConnectionId));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** sql/049: double-check PHAM VI ngay tai controller (khong chi dua vao middleware) - xem
 * requireVoucherFilterAccess.js. Quan tri doi tac chi duoc sua DUNG id cua ho. */
function assertInScope(req, id) {
  return req.voucherFilterScope === 'all' || Number(req.voucherFilterConnectionId) === Number(id);
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!assertInScope(req, id)) {
      return res.status(403).json({ success: false, message: 'Ban khong co quyen sua he thong nay' });
    }
    const filterError = apiConnectionService.validateCodePrefixFilterConfig(req.body);
    if (filterError) return res.status(400).json({ success: false, message: filterError });

    const before = await apiConnectionService.getPrefixFilterOnly(id);
    if (!before) return res.status(404).json({ success: false, message: 'Khong tim thay he thong' });

    await apiConnectionService.updatePrefixFilterOnly(id, req.body, req.user.username);
    const after = await apiConnectionService.getPrefixFilterOnly(id);

    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_VOUCHER_CODE_FILTER',
      targetUsername: before.name,
      detail: {
        before: { mode: before.codePrefixFilterMode, excluded: before.excludedCodePrefixes, allowed: before.allowedCodePrefixes },
        after: { mode: after.codePrefixFilterMode, excluded: after.excludedCodePrefixes, allowed: after.allowedCodePrefixes },
      },
    });

    res.json({ success: true, data: after });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, update };
