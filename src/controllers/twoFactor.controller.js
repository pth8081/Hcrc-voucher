const twoFactorService = require('../services/twoFactorService');
const authService = require('../services/authService');
const loginGuard = require('../utils/loginGuard');

async function setupInit(req, res, next) {
  try {
    const { userId, username } = req.twoFactorSubject;
    const data = await twoFactorService.startSetup(userId, username);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function setupVerify(req, res, next) {
  try {
    const { userId } = req.twoFactorSubject;
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Thieu ma xac thuc' });
    }
    await twoFactorService.verifySetup(userId, code);

    // Thiet lap lan dau (token TAM, chua co phien) -> cap phien day du luon de vao thang ung
    // dung. Doi thiet bi trong luc da co phien day du -> giu nguyen phien hien tai, khong can
    // token moi.
    if (req.twoFactorContext === 'pending') {
      const user = await authService.findUserById(userId);
      return res.json({ success: true, data: authService.issueSession(user) });
    }
    return res.json({ success: true, data: { alreadySignedIn: true } });
  } catch (err) {
    next(err);
  }
}

async function loginVerify(req, res, next) {
  try {
    const { userId, username } = req.pending;
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Thieu ma xac thuc' });
    }

    // Chi tai khoan quan tri moi toi duoc buoc nay (2FA chi bat buoc voi status=1), nen luon
    // dung chinh sach khoa 'admin' (50 lan/2 phut) - xem loginGuard.js.
    loginGuard.assertNotLocked(username);
    try {
      await twoFactorService.verifyLogin(userId, code);
    } catch (err) {
      loginGuard.recordResult(username, false, 'admin');
      throw err;
    }
    loginGuard.recordResult(username, true, 'admin');

    const user = await authService.findUserById(userId);
    res.json({ success: true, data: authService.issueSession(user) });
  } catch (err) {
    next(err);
  }
}

/** Nhap lai mat khau de xem lai QR cua secret 2FA HIEN TAI (them thiet bi Authenticator thu 2),
 * khong doi secret. Gioi han so lan thu sai nhu loginVerify, tranh bi do mat khau qua endpoint
 * nay. */
async function showQr(req, res, next) {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'Thieu mat khau xac nhan' });
    }

    loginGuard.assertNotLocked(req.user.username);
    const user = await authService.findUserByUsername(req.user.username);
    const passwordOk = user && (await authService.comparePassword(password, user.Password));
    if (!passwordOk) {
      loginGuard.recordResult(req.user.username, false, 'admin');
      return res.status(401).json({ success: false, message: 'Mat khau khong dung' });
    }
    loginGuard.recordResult(req.user.username, true, 'admin');

    const data = await twoFactorService.showCurrentQr(req.user.userId, req.user.username);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function status(req, res, next) {
  try {
    const data = await twoFactorService.getStatus(req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listAdmins(req, res, next) {
  try {
    const data = await twoFactorService.listAdminStatus();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function adminReset(req, res, next) {
  try {
    const targetUserId = Number(req.params.userId);
    if (Number(req.user.userId) === targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Khong the tu go xac thuc hai yeu to cua chinh minh - can mot quan tri vien khac thuc hien.',
      });
    }
    await twoFactorService.adminResetOther(targetUserId, req.user.username);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { setupInit, setupVerify, loginVerify, showQr, status, listAdmins, adminReset };
