const userScheduleService = require('../services/userScheduleService');
const reportAccessService = require('../services/reportAccessService');
const permissionService = require('../services/permissionService');
const userAdminService = require('../services/userAdminService');
const redemptionUnitService = require('../services/redemptionUnitService');
const auditLogService = require('../services/auditLogService');
const authService = require('../services/authService');
const sessionRevalidation = require('../utils/sessionRevalidation');
const userVoucherSystemService = require('../services/userVoucherSystemService');
const companyService = require('../services/companyService');

/** redemptionUnitId (neu co) luon uu tien - tra ve LocationCode that cua Don vi thu hoi da
 * chon, thay the moi gia tri locationsDetail go tay. Nem loi 400 neu chon 1 id khong ton tai. */
async function resolveLocationsDetail({ redemptionUnitId, locationsDetail }) {
  if (!redemptionUnitId) return locationsDetail || null;
  const code = await redemptionUnitService.getLocationCodeById(Number(redemptionUnitId));
  if (!code) {
    const err = new Error('Khong tim thay Don vi thu hoi da chon');
    err.statusCode = 400;
    err.publicMessage = 'Don vi thu hoi da chon khong ton tai, vui long chon lai';
    throw err;
  }
  return code;
}

async function list(req, res, next) {
  try {
    const includeDeleted = req.query.includeDeleted === 'true';
    const [withSchedule, withAccess, voucherSystemsByUserId] = await Promise.all([
      userScheduleService.listAllWithSchedule(includeDeleted),
      reportAccessService.listUserAccess(),
      userVoucherSystemService.listUserAccess(),
    ]);
    const accessByUserId = new Map(withAccess.map((a) => [a.userId, a]));
    const data = await Promise.all(
      withSchedule.map(async (u) => {
        const access = accessByUserId.get(u.userId);
        const permissions = await permissionService.resolvePermissions({ userId: u.userId, role: u.role });
        return {
          ...u,
          reportAccessGroupId: access ? access.groupId : null,
          reportAccessGroupName: access ? access.groupName : null,
          permissions,
          // Mang rong = khong gioi han (duoc dung/xem TOAN BO he thong) - xem userVoucherSystemService.js
          voucherSystems: voucherSystemsByUserId.get(u.userId) || [],
        };
      })
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { username, password, fullName, locationsGroup, redemptionUnitId, role, companyId, email, phone } = req.body;
    const locationsDetail = await resolveLocationsDetail({ redemptionUnitId, locationsDetail: req.body.locationsDetail });
    const created = await userAdminService.createUser(
      { username, password, fullName, locationsGroup, locationsDetail, role, email, phone },
      req.user.username
    );
    // v3.94 (xem sql/043): "Cong ty" chon o form tao tai khoan TRUOC DAY chi dung de loc o chon
    // Diem tieu (khong duoc luu) - gio luu TRUC TIEP (VoucherAppPermissions.CompanyId) de co the
    // xac dinh "tai khoan nay thuoc cong ty nao" ngay ca khi cong ty do la "Cong ty doi tac"
    // (loai nay khong co Diem tieu nen khong suy ra duoc qua Locations_Detail nhu truoc).
    if (companyId && Number(role) !== 1) {
      await permissionService.setCompanyAndPartnerAccount(created.userId, { companyId: Number(companyId), isPartnerAccount: false }, req.user.username);
    }
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'CREATE_USER',
      targetUsername: created.username,
      detail: {
        before: null,
        after: { role: Number(role) === 1 ? 'admin' : 'staff', redemptionUnitId: redemptionUnitId || null, locationsDetail, companyId: companyId || null },
      },
    });
    res.json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
}

/**
 * v3.94 (xem sql/043): gan/doi "Cong ty" TRUC TIEP + bat/tat "Tai khoan doi tac" cho 1 tai khoan
 * DA CO SAN (man "Tai khoan"). Theo dung yeu cau nguoi dung: CHI duoc BAT isPartnerAccount khi
 * tai khoan dang gan 1 CONG TY DA LA "Cong ty doi tac" (companyService.assertCanBePartnerAccount
 * nem loi 400 ro rang neu chua, huong dan admin chuyen cong ty truoc). Khi BAT thanh cong: tu
 * dong ep CanRedeemVoucher = 0 va go Diem tieu/dia diem hien co (tai khoan doi tac khong co chuc
 * nang thu hoi, khong can gan dia diem).
 */
async function updateCompany(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    await userAdminService.assertUserExists(userId);
    const before = await permissionService.getPermissions(userId);
    const { companyId, isPartnerAccount } = req.body;
    const normalizedCompanyId = companyId ? Number(companyId) : null;

    if (isPartnerAccount) {
      await companyService.assertCanBePartnerAccount(normalizedCompanyId);
    }

    await permissionService.setCompanyAndPartnerAccount(userId, { companyId: normalizedCompanyId, isPartnerAccount: !!isPartnerAccount }, req.user.username);

    if (isPartnerAccount) {
      await permissionService.setPermissions(userId, { ...before, canRedeemVoucher: false }, req.user.username);
      await userAdminService.updateLocation(userId, null);
    }

    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_USER_COMPANY',
      targetUsername: req.body.username || String(req.params.userId),
      detail: {
        before: { companyId: before.companyId, isPartnerAccount: before.isPartnerAccount },
        after: { companyId: normalizedCompanyId, isPartnerAccount: !!isPartnerAccount },
      },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updateLocation(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    // L6: authService.findUserById() vua kiem tra ton tai (tra ve null neu khong co) VUA lay
    // luon trang thai TRUOC KHI sua de ghi vao audit log (xem ghi chu chi tiet o auditLogService.js).
    const before = await authService.findUserById(userId);
    if (!before) {
      const err = new Error('Khong tim thay tai khoan nay');
      err.statusCode = 400;
      err.publicMessage = 'Khong tim thay tai khoan nay (co the da bi xoa hoac id khong dung)';
      throw err;
    }
    const { redemptionUnitId, username } = req.body;
    const locationsDetail = await resolveLocationsDetail({ redemptionUnitId, locationsDetail: null });
    await userAdminService.updateLocation(userId, locationsDetail);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_USER_LOCATION',
      targetUsername: username || String(req.params.userId),
      detail: {
        before: { locationsDetail: before.Locations_Detail },
        after: { redemptionUnitId: redemptionUnitId || null, locationsDetail },
      },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const before = await authService.findUserById(userId);
    if (!before) {
      const err = new Error('Khong tim thay tai khoan nay');
      err.statusCode = 400;
      err.publicMessage = 'Khong tim thay tai khoan nay (co the da bi xoa hoac id khong dung)';
      throw err;
    }
    const { fullName, password, username, email, phone } = req.body;
    await userAdminService.updateProfile(userId, { fullName, password });
    // v3.100: Email/So dien thoai (sql/046) - doc lap voi FullName/Password (bang Users goc),
    // luu vao VoucherAppPermissions qua ham rieng, giong cach CompanyId/IsPartnerAccount da lam.
    await permissionService.setContactInfo(userId, { email, phone }, req.user.username);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_USER_PROFILE',
      targetUsername: username || String(req.params.userId),
      // L6: KHONG BAO GIO ghi mat khau (ca cu lan moi, du la hash) vao audit log - chi ghi CO
      // doi hay khong, giu nguyen hanh vi cu cho truong nay, chi them before/after cho ho ten.
      detail: {
        before: { fullName: before.FullName },
        after: { fullName: fullName != null ? String(fullName).trim() : before.FullName, passwordReset: !!password },
      },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updateDeleteStatus(req, res, next) {
  try {
    const { isDeleted, username } = req.body;
    const userId = Number(req.params.userId);
    if (isDeleted && userId === req.user.userId) {
      return res.status(400).json({ success: false, message: 'Khong the tu xoa chinh tai khoan dang dang nhap' });
    }
    await userAdminService.assertUserExists(userId);
    const beforeSchedule = await userScheduleService.getSchedule(userId);
    await userScheduleService.setDeleted(userId, !!isDeleted, req.user.username);
    sessionRevalidation.invalidate(userId); // H1: co hieu luc ngay, khong cho token cu qua 30s cache
    await auditLogService.log({
      actorUsername: req.user.username,
      action: isDeleted ? 'DELETE_USER' : 'RESTORE_USER',
      targetUsername: username || String(userId),
      detail: {
        before: { isDeleted: !!(beforeSchedule && beforeSchedule.IsDeleted) },
        after: { isDeleted: !!isDeleted },
      },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updatePermissions(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    await userAdminService.assertUserExists(userId);
    const before = await permissionService.getPermissions(userId);
    const {
      canRedeemVoucher,
      canViewReconciliation,
      canViewSummary,
      canViewUsedVouchers,
      canViewBusinessGuide,
      canViewSystemGuide,
    } = req.body;
    const perms = {
      canRedeemVoucher: !!canRedeemVoucher,
      canViewReconciliation: !!canViewReconciliation,
      canViewSummary: !!canViewSummary,
      canViewUsedVouchers: !!canViewUsedVouchers,
      canViewBusinessGuide: !!canViewBusinessGuide,
      canViewSystemGuide: !!canViewSystemGuide,
    };
    await permissionService.setPermissions(userId, perms, req.user.username);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_PERMISSIONS',
      targetUsername: req.body.username || String(req.params.userId),
      detail: { before, after: perms },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updateSchedule(req, res, next) {
  try {
    const { activeFrom, activeUntil, username } = req.body;
    const userId = Number(req.params.userId);
    if (activeFrom && activeUntil && new Date(activeFrom) > new Date(activeUntil)) {
      return res.status(400).json({ success: false, message: 'Thoi gian kich hoat phai truoc thoi gian het han' });
    }
    // M4: nut "Khoa" tren giao dien (users.js#toggleLockFields) chi dien san gia tri vao 2 o
    // Kich hoat tu/Het han cua CHINH endpoint nay - khac voi nut "Xoa" (updateDeleteStatus) da co
    // check tu bao ve, endpoint nay truoc day KHONG co, 1 admin co the vo tinh (hoac bi du) tu
    // dat lich khoa chinh minh, khong ai khac dang nhap duoc de mo lai (phai nho DBA can thiep
    // thang vao CSDL).
    if (userId === req.user.userId) {
      const newState = userScheduleService.evaluate({ ActiveFrom: activeFrom, ActiveUntil: activeUntil }).state;
      if (newState !== 'active') {
        return res.status(400).json({ success: false, message: 'Khong the tu dat lich lam khoa chinh tai khoan dang dang nhap' });
      }
    }
    await userAdminService.assertUserExists(userId);
    const beforeSchedule = await userScheduleService.getSchedule(userId);
    await userScheduleService.upsertSchedule(userId, { activeFrom, activeUntil }, req.user.username);
    sessionRevalidation.invalidate(userId); // H1: khoa/mo khoa co hieu luc ngay
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_SCHEDULE',
      targetUsername: username || String(req.params.userId),
      detail: {
        before: { activeFrom: beforeSchedule && beforeSchedule.ActiveFrom, activeUntil: beforeSchedule && beforeSchedule.ActiveUntil },
        after: { activeFrom, activeUntil },
      },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updateReportAccess(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    await userAdminService.assertUserExists(userId);
    const before = await reportAccessService.getUserGroup(userId);
    const { groupId, username } = req.body;
    await reportAccessService.setUserGroup(userId, groupId ? Number(groupId) : null, req.user.username);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_REPORT_ACCESS',
      targetUsername: username || String(req.params.userId),
      detail: { before: { groupId: before ? before.groupId : null }, after: { groupId: groupId || null } },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updateVoucherSystems(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    await userAdminService.assertUserExists(userId);
    const before = await userVoucherSystemService.getAllowedConnectionIds(userId);
    const { connectionIds, username } = req.body;
    const normalized = Array.isArray(connectionIds) ? connectionIds.map(Number).filter((n) => Number.isInteger(n)) : [];
    await userVoucherSystemService.setAllowedConnections(userId, normalized);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_USER_VOUCHER_SYSTEMS',
      targetUsername: username || String(req.params.userId),
      detail: { before: { connectionIds: before }, after: { connectionIds: normalized } },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * Gan/go quyen "quan tri gioi han theo 1 he thong voucher" (partner-admin, xem sql/031,
 * middleware/requirePartnerAdmin.js) cho 1 tai khoan NHAN VIEN - cho phep doi tac (vd Fuji) tu
 * xem/tao/khoa cac tai khoan CHI dung he thong cua ho, ma khong thay duoc tai khoan quan tri HCRC
 * hay tai khoan cua doi tac khac (xem partnerAdminService.js).
 *
 * Khi GAN (connectionId co gia tri): dong thoi EP UserVoucherSystems cua chinh tai khoan nay ve
 * DUY NHAT he thong do - dam bao ho cung CHI thay/dung dung he thong minh duoc quan tri (nhat
 * quan voi dieu kien "exact match" ma partnerAdminService.js#listScopedUsers dung de loc danh
 * sach), tranh truong hop quan tri 1 he thong nhung ban than lai dung duoc he thong khac. Khi GO
 * (connectionId = null): KHONG dong gi den UserVoucherSystems hien co - tranh thay doi ngoai y
 * muon, admin tu dieu chinh rieng o o tick "He thong voucher duoc dung" neu can.
 */
async function updatePartnerAdmin(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    await userAdminService.assertUserExists(userId);
    const { connectionId, username } = req.body;
    const normalized = connectionId ? Number(connectionId) : null;
    const before = await permissionService.getPermissions(userId);
    await permissionService.setPartnerAdminConnection(userId, normalized, req.user.username);
    // M20 (v3.81): 4 quyen con (tung tab cua man hinh "Quan tri doi tac") - mac dinh TICK SAN ca
    // 4 khi GUI khong kem (vd request cu tu truoc khi co tinh nang nay, hoac form khong hien o
    // khi GO quyen) - giu dung hanh vi "thay du 4 tab" tu truoc, admin phai CHU DONG bo tick moi
    // gioi han bot. Luon ghi (ca khi GO, connectionId=null) de tranh 1 dong quyen "treo" sai tu
    // lan gan truoc, du khong con tac dung gi khi isPartnerAdmin=false.
    const tabPerms = {
      canManageAccounts: req.body.canManageAccounts !== false,
      canManageOrg: req.body.canManageOrg !== false,
      canViewAuditLog: req.body.canViewAuditLog !== false,
      canViewScanLog: req.body.canViewScanLog !== false,
    };
    await permissionService.setPartnerAdminTabPermissions(userId, tabPerms, req.user.username);
    if (normalized) {
      await userVoucherSystemService.setAllowedConnections(userId, [normalized]);
      // v3.84: duoc gan "Quan tri doi tac" thi TU DONG co san quyen "Lich gui email bao cao" -
      // khong bat phai di tick rieng ngay sau do. CHI cap khi GAN (khong bao gio go khi THU HOI
      // quyen "Quan tri doi tac" - xem ghi chu o grantEmailScheduleAccess()).
      await permissionService.grantEmailScheduleAccess(userId, req.user.username);
      // v3.98 (theo yeu cau nguoi dung): tuong tu, TU DONG co san CA 3 quyen xem bao cao (Doi
      // soat/Tong hop/Voucher da su dung) ngay khi duoc gan "Quan tri doi tac" - khong bat phai
      // di tick rieng tung quyen o man "Tai khoan" nua. Xem ghi chu day du o
      // permissionService.js#grantReportViewAccess.
      await permissionService.grantReportViewAccess(userId, req.user.username);
    }
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_PARTNER_ADMIN',
      targetUsername: username || String(userId),
      detail: {
        before: { partnerAdminConnectionId: before.partnerAdminConnectionId },
        after: { partnerAdminConnectionId: normalized, ...tabPerms },
      },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * Doi 5 quyen man hinh "Quan tri" (AdminCanXxx) cho 1 tai khoan Quan tri KHAC (M20, v3.81).
 *
 * BAT BUOC khong duoc tu sua CHINH MINH o day - tranh 1 tai khoan Quan tri vo tinh (hoac co y) bo
 * tick het 5 muc cua chinh ho, tu khoa khong con vao lai duoc man "Tai khoan" de mo lai cho chinh
 * minh (khong con tai khoan Quan tri nao khac thao tac ho). Dung cung ly do voi M4 (khong tu khoa
 * chinh tai khoan dang dang nhap) nhung ap dung rong hon (chan toan bo thao tac, khong chi rieng
 * "khoa").
 */
async function updateAdminFeaturePermissions(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    if (userId === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: 'Khong the tu sua quyen quan tri he thong cua chinh tai khoan dang dang nhap - nho 1 Quan tri khac sua ho',
      });
    }
    await userAdminService.assertUserExists(userId);
    const { username } = req.body;
    const before = await permissionService.getAdminFeaturePermissions(userId);
    const perms = {
      canManageUnits: !!req.body.canManageUnits,
      canManageConnections: !!req.body.canManageConnections,
      canManageUsers: !!req.body.canManageUsers,
      canViewAdminLog: !!req.body.canViewAdminLog,
      canManageEmailSettings: !!req.body.canManageEmailSettings,
    };
    await permissionService.setAdminFeaturePermissions(userId, perms, req.user.username);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'UPDATE_ADMIN_FEATURE_PERMISSIONS',
      targetUsername: username || String(userId),
      detail: { before, after: perms },
    });
    res.json({ success: true, data: perms });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  create,
  updatePermissions,
  updateSchedule,
  updateReportAccess,
  updateLocation,
  updateProfile,
  updateDeleteStatus,
  updateVoucherSystems,
  updatePartnerAdmin,
  updateAdminFeaturePermissions,
  updateCompany,
};
