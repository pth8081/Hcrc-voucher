const apiConnectionService = require('../services/apiConnectionService');
const auditLogService = require('../services/auditLogService');

/** Danh sach he thong nguoi dung hien tai duoc phep xem/sua - HCRC (scope='all') thay het, Quan
 * tri doi tac (scope='own') CHI thay dung 1 he thong da gan (req.voucherFilterConnectionId).
 * sql/050: tra THEM `canEdit` (top-level, ap dung chung cho ca danh sach - quyen Sua/Xem cua 1
 * tai khoan la DONG NHAT cho moi he thong ho thay duoc, khong can gan rieng tung dong) de frontend
 * biet hien nut "Luu thay doi" hay khoa form lai thanh CHI XEM - xem voucher-code-filter.js. */
async function list(req, res, next) {
  try {
    const all = await apiConnectionService.listPrefixFilterOnly();
    const systems = req.voucherFilterScope === 'all'
      ? all
      : all.filter((c) => Number(c.id) === Number(req.voucherFilterConnectionId));
    res.json({ success: true, data: { systems, canEdit: !!req.voucherFilterCanEdit } });
  } catch (err) {
    next(err);
  }
}

/** sql/049/050: double-check PHAM VI + QUYEN SUA ngay tai controller (khong chi dua vao
 * middleware) - xem requireVoucherFilterAccess.js. Quan tri doi tac chi duoc sua DUNG id cua ho;
 * tai khoan CHI co quyen Xem (khong co quyen Sua) khong duoc goi duoc ham nay, du dung id. */
function assertInScope(req, id) {
  return req.voucherFilterScope === 'all' || Number(req.voucherFilterConnectionId) === Number(id);
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!req.voucherFilterCanEdit) {
      return res.status(403).json({ success: false, message: 'Tai khoan cua ban chi co quyen XEM, khong co quyen sua cau hinh loc ma voucher' });
    }
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
