const jwt = require('jsonwebtoken');

/**
 * Chap nhan CHI token TAM (xem authService.issuePendingToken) co purpose nam trong
 * allowedPurposes - dung cho 2 buoc "thiet lap 2FA lan dau" va "xac minh ma 2FA khi dang
 * nhap", luc nguoi dung CHUA co phien day du. req.pending = { purpose, userId, username }.
 */
function require2FAPending(allowedPurposes) {
  return function (req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Thieu token xac thuc' });
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (!allowedPurposes.includes(payload.purpose)) {
        return res.status(401).json({ success: false, message: 'Token khong hop le hoac het han' });
      }
      req.pending = payload;
      return next();
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Token khong hop le hoac het han' });
    }
  };
}

/**
 * Rieng cho 2 API thiet lap 2FA (setup-init/setup-verify): chap nhan CA HAI truong hop -
 *  - Token TAM purpose='2fa_setup' (buoc BAT BUOC ngay sau khi dang nhap lan dau, chua co
 *    phien day du).
 *  - Phien dang nhap DAY DU cua chinh admin do (tu chon "doi thiet bi 2FA" khi da dang nhap
 *    binh thuong, van con giu duoc thiet bi cu).
 * Ket qua chuan hoa vao req.twoFactorSubject = { userId, username }.
 */
function resolveSetupSubject(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Thieu token xac thuc' });
  }
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token khong hop le hoac het han' });
  }

  if (payload.purpose === '2fa_setup') {
    req.twoFactorSubject = { userId: payload.userId, username: payload.username };
    req.twoFactorContext = 'pending';
    return next();
  }
  if (payload.purpose === 'session' && Number(payload.role) === 1) {
    req.twoFactorSubject = { userId: payload.userId, username: payload.username };
    req.twoFactorContext = 'session';
    return next();
  }
  return res.status(401).json({ success: false, message: 'Token khong hop le hoac het han' });
}

module.exports = { require2FAPending, resolveSetupSubject };
