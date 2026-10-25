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
 * (xem requirePartnerAdmin.js). Pham vi XEM gom cac tai khoan NHAN VIEN (role=0) co DUNG trong
 * danh sach he thong duoc dung CHUA connectionId nay (khong bat buoc CHI DUY NHAT nua, tu v3.68) -
 * loai tru hoan toan:
 *  - Tai khoan quan tri (role=1), du co the cung duoc gan he thong nay trong UserVoucherSystems.
 *  - Tai khoan khong gioi han he thong nao (null/rong trong UserVoucherSystems) - day la dang
 *    "khong thuoc pham vi ai ca" (dung duoc TOAN BO he thong, ke ca he thong tuong lai), khac han
 *    ve ban chat voi "dung chung 1 vai he thong cu the ke ca he thong cua minh".
 *
 * Moi dong tra ve co them co `exclusiveToThisSystem`:
 *  - true  = tai khoan CHI dung DUY NHAT he thong cua doi tac nay (dung nhu truoc day) - doi tac
 *            duoc TOAN QUYEN (xem + Khoa/Mo khoa).
 *  - false = tai khoan dang DUNG CHUNG them he thong khac (vd quan tri HCRC da cap them quyen
 *            dung he thong HCRC cho 1 tai khoan Fuji tao, de 1 nhan vien dang nhap 1 lan quet
 *            duoc ca 2 he thong) - doi tac VAN XEM duoc (minh bach, biet tai khoan nay ton tai va
 *            dang hoat dong the nao o phan cua ho), nhung KHONG Khoa/Mo khoa duoc nua (xem
 *            setScopedUserActive) - tranh 1 doi tac khoa nham chan luon ca dang nhap phia he
 *            thong kia. Gia tri nay tinh LAI TUOI moi lan goi (doc truc tiep UserVoucherSystems
 *            hien tai) - ngay quan tri HCRC go bot he thong HCRC khoi tai khoan do (ve lai dung 1
 *            he thong cua doi tac), co nay tu dong thanh true lai NGAY lan goi tiep theo, doi tac
 *            co lai toan quyen khoa/mo khoa ma khong can ai can thiep gi them.
 */
async function listScopedUsers(connectionId) {
  const [withSchedule, voucherSystemsByUserId] = await Promise.all([
    userScheduleService.listAllWithSchedule(true), // true = gom ca tai khoan da xoa mem, de doi tac tu khoi phuc lai duoc chinh tai khoan ho da tao
    userVoucherSystemService.listUserAccess(),
  ]);

  return withSchedule
    .filter((u) => Number(u.role) === 0)
    .map((u) => {
      const systemIds = (voucherSystemsByUserId.get(u.userId) || []).map((s) => s.connectionId);
      return { u, systemIds };
    })
    .filter(({ systemIds }) => systemIds.includes(connectionId))
    .map(({ u, systemIds }) => ({
      userId: u.userId,
      username: u.username,
      fullName: u.fullName,
      state: u.state,
      isDeleted: u.isDeleted,
      exclusiveToThisSystem: systemIds.length === 1,
    }));
}

/** Nem loi 403 neu userId KHONG thuoc dung pham vi cua connectionId nay (xem listScopedUsers) -
 * bat buoc goi truoc MOI thao tac sua tren 1 userId cu the (vd khoa/mo khoa), tranh 1 tai khoan
 * partner-admin doan/thu userId cua tai khoan khac (ke ca admin HCRC) de thao tac ngoai pham vi.
 * Tra ve CHINH dong du lieu (kem co exclusiveToThisSystem) de noi goi dung tiep, khong phai goi
 * lai listScopedUsers() lan nua. */
async function assertInScope(userId, connectionId) {
  const scoped = await listScopedUsers(connectionId);
  const row = scoped.find((u) => u.userId === userId);
  if (!row) {
    throw forbidden('Tai khoan nay khong thuoc pham vi quan tri cua ban');
  }
  return row;
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
 * UserVoucherSystems (tai khoan van giu dung he thong da gan, chi tam ngung dang nhap duoc).
 *
 * BAT BUOC tai khoan dang CHI dung DUY NHAT he thong cua doi tac nay (exclusiveToThisSystem) -
 * tai khoan dang dung CHUNG them he thong khac (duoc quan tri day du cap them, xem listScopedUsers)
 * se bi tu choi (403): "Khoa" o day thuc chat la khoa TOAN BO dang nhap (khong co khai niem "khoa
 * rieng phan cua doi tac nay"), neu cho doi tac tu khoa 1 tai khoan dung chung se vo tinh (hoac co
 * y) chan luon ca dang nhap phia he thong kia - chi quan tri day du (co day du boi canh ca 2 phia)
 * moi duoc phep khoa/mo khoa tai khoan dang dung chung. */
async function setScopedUserActive(userId, connectionId, isDeleted, updatedBy) {
  const row = await assertInScope(userId, connectionId);
  if (!row.exclusiveToThisSystem) {
    throw forbidden(
      'Tai khoan nay dang duoc quan tri day du cap them quyen dung he thong khac - chi quan tri day du moi khoa/mo khoa duoc tai khoan nay.'
    );
  }
  await userScheduleService.setDeleted(userId, isDeleted, updatedBy);
}

/**
 * Doi tac tu "go" DUNG he thong cua CHINH HO khoi 1 tai khoan dang DUNG CHUNG them he thong khac
 * (vd Fuji go dong "Fuji" khoi 1 tai khoan dang dung ca Fuji+HCRC) - CHI xoa dung 1 dong
 * (userVoucherSystemService.js#removeConnection), KHONG BAO GIO dong den dong he thong KHAC (vd
 * HCRC) tai khoan do dang duoc gan. Sau khi go, tai khoan se KHONG con thuoc pham vi cua doi tac
 * nay nua (bien mat khoi danh sach cua ho - listScopedUsers() loc theo contains-match), nhung
 * VAN dang nhap/dung duoc binh thuong o (cac) he thong con lai.
 *
 * BAT BUOC tai khoan dang DUNG CHUNG (exclusiveToThisSystem=false) - neu day la he thong DUY
 * NHAT con lai (exclusiveToThisSystem=true), tu choi (400): xoa not se de lai 0 dong trong
 * UserVoucherSystems, theo dung quy uoc cua userVoucherSystemService.js thi 0 dong = KHONG GIOI
 * HAN (dung/xem duoc TOAN BO he thong, ke ca he thong tuong lai) - vo tinh CAP THEM quyen cho tai
 * khoan do thay vi tuoc quyen nhu y doi tac muon. Huong dan dung nut "Khoa" thay the (dung cho
 * dung muc dich: tai khoan khong dung duoc nua, khong lam no thanh khong gioi han).
 */
async function removeOwnConnection(userId, connectionId) {
  const row = await assertInScope(userId, connectionId);
  if (row.exclusiveToThisSystem) {
    const err = new Error('Day la he thong duy nhat cua tai khoan nay - vui long dung nut "Khoa" thay vi "Go he thong", tranh vo tinh bien tai khoan thanh khong gioi han he thong nao.');
    err.statusCode = 400;
    err.publicMessage = err.message;
    throw err;
  }
  await userVoucherSystemService.removeConnection(userId, connectionId);
}

module.exports = { listScopedUsers, assertInScope, createScopedUser, setScopedUserActive, removeOwnConnection };
