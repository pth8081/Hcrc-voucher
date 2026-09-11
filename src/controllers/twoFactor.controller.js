const twoFactorService = require('../services/twoFactorService');
const authService = require('../services/authService');
const loginGuard = require('../utils/loginGuard');
const auditLogService = require('../services/auditLogService');

/**
 * C3: khi goi tu 1 PHIEN DAY DU da co san (context='session' - nghia la "doi thiet bi 2FA"
 * trong luc van con dang nhap binh thuong, KHAC voi lan thiet lap dau tien luc chua co phien),
 * bat buoc nhap lai mat khau truoc khi cho phep sinh secret TOTP moi (ghi de thiet bi cu) -
 * cung 1 nguyen tac voi showQr ben duoi. Neu khong co buoc nay, ai lay duoc token phien (XSS,
 * may dung chung, token ro ri qua log...) co the tu dang ky lai thiet bi 2FA cua chinh minh
 * ma khong can biet mat khau, chiem quyen 2FA vinh vien.
 * Truong hop context='pending' (token TAM ngay sau khi dang nhap lan dau, CHUA co 2FA) khong
 * can buoc nay vi nguoi dung vua xac minh mat khau xong de co duoc token tam do roi.
 */
async function setupInit(req, res, next) {
  try {
    const { userId, username } = req.twoFactorSubject;

    if (req.twoFactorContext === 'session') {
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ success: false, message: 'Can nhap lai mat khau de doi thiet bi xac thuc hai yeu to' });
      }
      loginGuard.assertNotLocked(username);
      const user = await authService.findUserByUsername(username);
      const passwordOk = user && (await authService.comparePassword(password, user.Password));
      if (!passwordOk) {
        loginGuard.recordResult(username, false, 'admin');
        return res.status(401).json({ success: false, message: 'Mat khau khong dung' });
      }
      loginGuard.recordResult(username, true, 'admin');
    }

    const data = await twoFactorService.startSetup(userId, username);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function setupVerify(req, res, next) {
  try {
    const { userId, username } = req.twoFactorSubject;
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Thieu ma xac thuc' });
    }

    // Truoc day endpoint nay khong gioi han so lan thu ma TOTP nao (khac voi loginVerify/showQr
    // cung nhap ma xac thuc) - ai giu duoc token tam/phien hop le co the do ma khong gioi han
    // (da bi 1 dot ra soat sau phat hien). Dung chung chinh sach 'admin' voi loginVerify.
    loginGuard.assertNotLocked(username);
    try {
      await twoFactorService.verifySetup(userId, code);
    } catch (err) {
      loginGuard.recordResult(username, false, 'admin');
      throw err;
    }
    loginGuard.recordResult(username, true, 'admin');

    // Thiet lap lan dau (token TAM, chua co phien) -> cap phien day du luon de vao thang ung
    // dung. Doi thiet bi trong luc da co phien day du -> giu nguyen phien hien tai, khong can
    // token moi.
    if (req.twoFactorContext === 'pending') {
      const user = await authService.findUserById(userId);
      return res.json({ success: true, data: await authService.issueSession(user) });
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
    res.json({ success: true, data: await authService.issueSession(user) });
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
    // M3: truoc day khong kiem tra targetUserId co ton tai/co phai admin khong - goi voi 1 id
    // rac (userId khong ton tai, hoac cua 1 nhan vien khong bao gio bat 2FA) van tra ve
    // success:true va ghi vao Nhat ky quan tri "da go 2FA" du KHONG co gi thuc su xay ra.
    const targetUser = await authService.findUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Khong tim thay tai khoan can go xac thuc hai yeu to' });
    }
    if (Number(targetUser.status) !== 1) {
      return res.status(400).json({ success: false, message: 'Tai khoan nay khong phai quan tri vien, khong ap dung xac thuc hai yeu to' });
    }
    await twoFactorService.adminResetOther(targetUserId, req.user.username);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'RESET_2FA',
      targetUsername: req.body.username || String(targetUserId),
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { setupInit, setupVerify, loginVerify, showQr, status, listAdmins, adminReset };
