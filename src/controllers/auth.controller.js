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

/** Doi mat khau BAT BUOC trong lan dang nhap dau tien - chi chap nhan token TAM
 * purpose='password_change' (xem middleware/require2FAPending.js). */
async function changePassword(req, res, next) {
  try {
    const { userId } = req.pending;
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ success: false, message: 'Thieu mat khau moi' });
    }
    const result = await authService.changePasswordForced(userId, newPassword);
    return res.json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

module.exports = { login, changePassword };
