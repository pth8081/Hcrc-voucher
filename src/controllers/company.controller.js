const companyService = require('../services/companyService');

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
    res.status(201).json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    await companyService.update(req.params.id, req.body);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update };
