const authService = require('../services/authService');

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Thieu username hoac password' });
    }
    const result = await authService.login(username, password);
    return res.json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

module.exports = { login };
