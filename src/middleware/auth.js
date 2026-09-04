const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Thieu token xac thuc' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Token TAM (purpose='2fa_setup'/'2fa_verify', xem authService.issuePendingToken) khong
    // duoc coi la phien dang nhap day du - chan o day de khong the dung no goi bat ky API
    // nghiep vu nao khac ngoai 2 buoc thiet lap/xac minh 2FA (middleware/require2FAPending.js).
    if (payload.purpose !== 'session') {
      return res.status(401).json({ success: false, message: 'Token khong hop le hoac het han' });
    }
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token khong hop le hoac het han' });
  }
}

module.exports = { authenticate };
