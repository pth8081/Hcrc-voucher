const partnerApiKeyService = require('../services/partnerApiKeyService');
const sessionRevalidation = require('../utils/sessionRevalidation');
const authService = require('../services/authService');

// Gioi han rieng cho API key (khac ipLoginRateLimit.js - do la theo IP cho luong dang nhap;
// day la theo TUNG KEY, ap dung cho luong nghiep vu check/redeem cua doi tac). Nguong rong rai,
// chi de chan goi qua muc kiem soat/loi vong lap phia doi tac, khong phai gioi han nghiep vu
// binh thuong (1 diem tieu quet vai chuc ma/phut la binh thuong).
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_PER_KEY = 120;

// Nhu moi cache trong bo nho khac cua app nay (sessionRevalidation, loginGuard, ipRateLimit...) -
// rieng tung tien trinh worker (CLUSTER_WORKERS > 1), xem README muc 3e. Chap nhan duoc: gioi
// han thuc te co the long hon toi da N lan (N = so worker) thay vi dung 1 nguong tuyet doi.
const rateState = new Map(); // apiKeyId -> { count, windowStart }

function checkRateLimit(apiKeyId) {
  const now = Date.now();
  let s = rateState.get(apiKeyId);
  if (!s || now - s.windowStart > RATE_LIMIT_WINDOW_MS) {
    s = { count: 0, windowStart: now };
  }
  s.count += 1;
  rateState.set(apiKeyId, s);
  if (s.count > RATE_LIMIT_MAX_PER_KEY) {
    return Math.max(1, Math.ceil((s.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000));
  }
  return null;
}

/**
 * Xac thuc request tu doi tac bang header `X-API-Key` (rieng biet hoan toan voi JWT Bearer
 * dung cho UI web - xem middleware/auth.js), theo dung tai lieu API doi tac cung cap
 * (docs/api-voucher-check-redeem.md muc "API doanh cho doi tac"). Key duoc gan voi 1 TAI KHOAN
 * NHAN VIEN co san (xem partnerApiKeyService.js) - sau khi xac thuc thanh cong, `req.user` duoc
 * dung y het CAU TRUC ma middleware/auth.js dung (userId/username/locationsGroup/locationsDetail/
 * role), de tai dung NGUYEN VEN voucherService.js/requireFeature.js ma khong can sua logic
 * nghiep vu - request qua API key duoc xu ly y het tai khoan do tu dang nhap goi API.
 *
 * `scope`: 'check' | 'redeem' - key phai duoc cap dung quyen tuong ung (CanCheck/CanRedeem).
 */
function requireApiKey(scope) {
  return async function apiKeyAuth(req, res, next) {
    const rawKey = req.headers['x-api-key'];
    if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
      return res.status(401).json({ success: false, message: 'Thieu header X-API-Key' });
    }

    let record;
    try {
      const keyHash = partnerApiKeyService.hashKey(rawKey.trim());
      record = await partnerApiKeyService.findActiveByHash(keyHash);
    } catch (err) {
      return next(err);
    }

    if (!record) {
      return res.status(401).json({ success: false, message: 'API key khong hop le hoac da bi thu hoi' });
    }
    if (scope === 'check' && !record.canCheck) {
      return res.status(403).json({ success: false, message: 'API key nay khong duoc cap quyen goi /check' });
    }
    if (scope === 'redeem' && !record.canRedeem) {
      return res.status(403).json({ success: false, message: 'API key nay khong duoc cap quyen goi /redeem' });
    }

    const retryAfterSec = checkRateLimit(record.id);
    if (retryAfterSec !== null) {
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        success: false,
        message: `Vuot qua gioi han so lan goi API trong thoi gian ngan, vui long thu lai sau ${retryAfterSec} giay.`,
      });
    }

    // Doi chieu trang thai tai khoan MOI NHAT - CUNG 1 co che voi JWT (sessionRevalidation.js),
    // dam bao 1 tai khoan bi khoa/xoa/het han lich hieu luc sau khi cap key KHONG the tiep tuc
    // dung API key do de vong qua viec khoa tai khoan tren UI.
    let state;
    try {
      state = await sessionRevalidation.getFreshUserState(record.userId);
    } catch (err) {
      return next(err);
    }
    if (!state.exists || state.isDeleted || state.activeState !== 'active') {
      return res.status(403).json({ success: false, message: 'Tai khoan gan voi API key nay khong con hoat dong' });
    }

    let user;
    try {
      user = await authService.findUserById(record.userId);
    } catch (err) {
      return next(err);
    }
    if (!user) {
      return res.status(403).json({ success: false, message: 'Tai khoan gan voi API key nay khong con ton tai' });
    }

    req.user = {
      userId: user.UserID,
      username: user.Username,
      fullName: user.FullName,
      locationsGroup: user.Locations_Group,
      locationsDetail: user.Locations_Detail,
      role: state.role,
      apiKeyId: record.id,
    };

    // Best-effort, khong chan request chinh neu ghi LastUsedDate that bai.
    partnerApiKeyService.touchLastUsed(record.id).catch(() => {});

    return next();
  };
}

module.exports = { requireApiKey };
