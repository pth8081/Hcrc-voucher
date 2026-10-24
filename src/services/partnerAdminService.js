const userAdminService = require('./userAdminService');
const userScheduleService = require('./userScheduleService');
const userVoucherSystemService = require('./userVoucherSystemService');

function forbidden(message) {
  const err = new Error(message);
  err.statusCode = 403;
  err.publicMessage = message;
  return err;
}

/**
 * Hau thuan man hinh "Quan tri doi tac" (public/partner-admin.html) - ban RUT GON cua man hinh
 * "Tai khoan" danh cho 1 tai khoan duoc gan quyen quan tri GIOI HAN theo DUNG 1 he thong voucher
 * (xem requirePartnerAdmin.js). Pham vi xem/sua CHI gom cac tai khoan NHAN VIEN (role=0) ma he
 * thong voucher duoc dung la DUNG VA CHI DUY NHAT connectionId nay - loai tru hoan toan:
 *  - Tai khoan quan tri (role=1), du co the cung duoc gan he thong nay trong UserVoucherSystems.
 *  - Tai khoan dung chung nhieu he thong (vd Fuji + HCRC) hoac khong gioi han (null/rong) - tranh
 *    1 doi tac thay duoc tai khoan cung dang thao tac cho doi tac khac.
 * Day la "whitelist CHINH XAC" (exact match), khong phai "co chua connectionId nay".
 */
async function listScopedUsers(connectionId) {
  const [withSchedule, voucherSystemsByUserId] = await Promise.all([
    userScheduleService.listAllWithSchedule(true), // true = gom ca tai khoan da xoa mem, de doi tac tu khoi phuc lai duoc chinh tai khoan ho da tao
    userVoucherSystemService.listUserAccess(),
  ]);

  return withSchedule
    .filter((u) => Number(u.role) === 0)
    .filter((u) => {
      const systems = voucherSystemsByUserId.get(u.userId) || [];
      return systems.length === 1 && systems[0].connectionId === connectionId;
    })
    .map((u) => ({
      userId: u.userId,
      username: u.username,
      fullName: u.fullName,
      state: u.state,
      isDeleted: u.isDeleted,
    }));
}

/** Nem loi 403 neu userId KHONG thuoc dung pham vi cua connectionId nay (xem listScopedUsers) -
 * bat buoc goi truoc MOI thao tac sua tren 1 userId cu the (vd khoa/mo khoa), tranh 1 tai khoan
 * partner-admin doan/thu userId cua tai khoan khac (ke ca admin HCRC) de thao tac ngoai pham vi. */
async function assertInScope(userId, connectionId) {
  const scoped = await listScopedUsers(connectionId);
  if (!scoped.some((u) => u.userId === userId)) {
    throw forbidden('Tai khoan nay khong thuoc pham vi quan tri cua ban');
  }
}

/** Tao 1 tai khoan nhan vien MOI, LUON gan CUNG DUY NHAT he thong voucher cua partner-admin dang
 * tao (bo qua hoan toan moi gia tri role/he thong nguoi goi co the gui len) - dam bao tai khoan
 * moi tao LUON nam trong dung pham vi, hien ngay trong danh sach cua chinh partner-admin do. */
async function createScopedUser({ username, password, fullName }, connectionId, createdBy) {
  const created = await userAdminService.createUser({ username, password, fullName, role: 0 }, createdBy);
  await userVoucherSystemService.setAllowedConnections(created.userId, [connectionId]);
  return created;
}

/** Khoa/mo khoa (xoa mem/khoi phuc, tai su dung co che san co cua userScheduleService.js) 1 tai
 * khoan DA THUOC pham vi connectionId nay - CHI doi trang thai hoat dong, KHONG dong gi den
 * UserVoucherSystems (tai khoan van giu dung he thong da gan, chi tam ngung dang nhap duoc). */
async function setScopedUserActive(userId, connectionId, isDeleted, updatedBy) {
  await assertInScope(userId, connectionId);
  await userScheduleService.setDeleted(userId, isDeleted, updatedBy);
}

module.exports = { listScopedUsers, assertInScope, createScopedUser, setScopedUserActive };
