const reportAccessService = require('../services/reportAccessService');

async function list(req, res, next) {
  try {
    const data = await reportAccessService.listGroups();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

function validate(body) {
  const { groupName, scopeType, companyIds } = body;
  if (!groupName || !['ALL', 'SPECIFIC'].includes(scopeType)) {
    return 'Thieu groupName hoac scopeType khong hop le (phai la ALL hoac SPECIFIC)';
  }
  if (scopeType === 'SPECIFIC' && (!Array.isArray(companyIds) || !companyIds.length)) {
    return 'Nhom pham vi SPECIFIC phai chon it nhat 1 cong ty';
  }
  return null;
}

async function create(req, res, next) {
  try {
    const error = validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const id = await reportAccessService.createGroup(req.body);
    res.status(201).json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const error = validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    await reportAccessService.updateGroup(Number(req.params.id), req.body);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update };
