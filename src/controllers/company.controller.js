const companyService = require('../services/companyService');
const auditLogService = require('../services/auditLogService');

async function list(req, res, next) {
  try {
    const data = await companyService.list();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { companyCode, companyName } = req.body;
    if (!companyCode || !companyName) {
      return res.status(400).json({ success: false, message: 'Thieu companyCode hoac companyName' });
    }
    const id = await companyService.create(req.body);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'CREATE_COMPANY',
      targetUsername: companyName,
      detail: { before: null, after: { id, companyCode } },
    });
    res.status(201).json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { companyCode, companyName } = req.body;
    if (!companyCode || !companyName) {
      return res.status(400).json({ success: false, message: 'Thieu companyCode hoac companyName' });
    }
    const companyId = Number(req.params.id);
    // Dot ra soat sau phat hien: truoc day khong kiem tra cong ty co ton tai khong - sua 1 id da
    // bi xoa/khong ton tai truoc do van bao thanh cong (UPDATE anh huong 0 dong) va van ghi vao
    // audit log nhu the da sua thanh cong that.
    const before = await companyService.getById(companyId);
    if (!before) {
      return res.status(404).json({ success: false, message: 'Khong tim thay cong ty nay' });
    }
    await companyService.update(companyId, req.body, req.user.username);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_COMPANY',
      targetUsername: req.body.companyName || String(req.params.id),
      detail: {
        before: { companyCode: before.CompanyCode, companyName: before.CompanyName, status: before.Status },
        after: { id: req.params.id, companyCode: req.body.companyCode, companyName: req.body.companyName, status: req.body.status },
      },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/** Xem truoc so Diem tieu/tai khoan se bi anh huong NEU chuyen cong ty nay sang "Cong ty doi
 * tac" - dung cho hop thoai xac nhan o units.js/partner-admin.js TRUOC khi goi update() that su. */
async function convertPreview(req, res, next) {
  try {
    const companyId = Number(req.params.id);
    const before = await companyService.getById(companyId);
    if (!before) {
      return res.status(404).json({ success: false, message: 'Khong tim thay cong ty nay' });
    }
    const preview = await companyService.getConvertPreview(companyId);
    res.json({ success: true, data: preview });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const companyId = Number(req.params.id);
    const before = await companyService.getById(companyId);
    if (!before) {
      return res.status(404).json({ success: false, message: 'Khong tim thay cong ty nay' });
    }
    await companyService.remove(companyId);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'DELETE_COMPANY',
      targetUsername: before.CompanyName,
      detail: { before: { companyCode: before.CompanyCode, companyName: before.CompanyName }, after: null },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove, convertPreview };
