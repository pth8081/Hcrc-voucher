const userAdminService = require('./userAdminService');
const userScheduleService = require('./userScheduleService');
const userVoucherSystemService = require('./userVoucherSystemService');
const permissionService = require('./permissionService');
const companyService = require('./companyService');
const redemptionUnitService = require('./redemptionUnitService');
const locationService = require('./locationService');

function forbidden(message) {
  const err = new Error(message);
  err.statusCode = 403;
  err.publicMessage = message;
  return err;
}

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.publicMessage = message;
  return err;
}

/**
 * Hau thuan man hinh "Quan tri doi tac" (public/partner-admin.html) - ban RUT GON cua man hinh
 * "Tai khoan" danh cho 1 tai khoan duoc gan quyen quan tri GIOI HAN theo DUNG 1 he thong voucher
 * (xem requirePartnerAdmin.js). Pham vi XEM BAT BUOC thoa CA 2 dieu kien (tu v3.70):
 *  1. Tai khoan nhan vien (role=0) nay BAN DAU do CHINH doi tac nay tao ra, qua man hinh tu phuc
 *     vu nay (`CreatedByPartnerConnectionId` - co dinh VINH VIEN tu luc tao, xem sql/035) - KHONG
 *     PHAI "dang dung he thong cua ho" la du. Vi du 1 tai khoan do quan tri day du HCRC tao truc
 *     tiep qua man hinh "Tai khoan", sau do duoc cap THEM quyen dung he thong Fuji (de 1 nhan vien
 *     dang nhap 1 lan quet duoc ca 2 he thong) - tai khoan nay KHONG xuat hien trong danh sach
 *     cua Fuji (khong phai ho tao ra, khong nen tu quan ly duoc no), du HIEN TAI co dung he thong
 *     Fuji that. Tab "Hoat dong quet/thu hoi" (muc xem Nhat ky he thong) KHONG ap dung dieu kien
 *     nay - van loc thuan theo ConnectionName tren tung giao dich, nen Fuji van thay dung cac luot
 *     quet he thong Fuji cua tai khoan do, chi khong tu quan ly duoc chinh tai khoan.
 *  2. HIEN TAI van con dung he thong cua ho (UserVoucherSystems chua connectionId nay) - doc TUOI
 *     moi lan goi, KHONG dua vao dieu kien (1) la du: 1 tai khoan DO CHINH doi tac tao ra nhung
 *     sau do bi quan tri day du go het he thong cua ho (vd Fuji tu go qua removeOwnConnection(),
 *     hoac quan tri day du go thay) se KHONG con hien ra nua - cho den khi duoc gan lai dung he
 *     thong do (vi dieu kien (1) KHONG BAO GIO doi, tai khoan se TU DONG xuat hien tro lai ngay,
 *     khong can tao lai).
 * Loai tru hoan toan: tai khoan quan tri (role=1); tai khoan khong gioi han he thong nao (null/
 * rong trong UserVoucherSystems, "khong thuoc pham vi ai ca", dung duoc TOAN BO he thong ke ca
 * he thong tuong lai).
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
  const [withSchedule, voucherSystemsByUserId, createdByPartnerByUserId] = await Promise.all([
    userScheduleService.listAllWithSchedule(true), // true = gom ca tai khoan da xoa mem, de doi tac tu khoi phuc lai duoc chinh tai khoan ho da tao
    userVoucherSystemService.listUserAccess(),
    permissionService.listCreatedByPartnerConnection(),
  ]);

  const rows = withSchedule
    .filter((u) => Number(u.role) === 0)
    .filter((u) => createdByPartnerByUserId.get(u.userId) === connectionId)
    .map((u) => {
      const systemIds = (voucherSystemsByUserId.get(u.userId) || []).map((s) => s.connectionId);
      return { u, systemIds };
    })
    .filter(({ systemIds }) => systemIds.includes(connectionId));

  // Promise.all: resolve ten dia diem (bat dong bo) cho TUNG tai khoan song song, tranh goi tuan
  // tu lam cham man hinh khi doi tac co nhieu nhan vien.
  return Promise.all(
    rows.map(async ({ u, systemIds }) => ({
      userId: u.userId,
      username: u.username,
      fullName: u.fullName,
      state: u.state,
      isDeleted: u.isDeleted,
      exclusiveToThisSystem: systemIds.length === 1,
      // v3.76: tra them diem tieu HIEN TAI (ma + ten da resolve) de man hinh "Sua tai khoan" hien
      // ro va chon san dung diem tieu dang gan, khong bat doi tac phai tra cuu rieng. Tra them
      // quyen tinh nang HIEN TAI (6 quyen) de man hinh tick san dung trang thai - KHONG tra
      // partnerAdminConnectionId/isPartnerAdmin (permissionService.getPermissions() van tra ve
      // 2 truong nay, nhung frontend chi doc 6 quyen tinh nang can thiet, khong dung 2 truong con
      // lai cho man hinh nay).
      locationsDetail: u.locationsDetail || null,
      locationName: u.locationsDetail ? await locationService.getDetailNameByCode(u.locationsDetail) : null,
      permissions: await permissionService.getPermissions(u.userId),
    }))
  );
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
 * moi tao LUON nam trong dung pham vi, hien ngay trong danh sach cua chinh partner-admin do. Ghi
 * nho CreatedByPartnerConnectionId = connectionId DUY NHAT 1 LAN o day (xem sql/035) - gia tri
 * nay se KHONG BAO GIO doi sau do du UserVoucherSystems cua tai khoan co thay doi the nao, la can
 * cu de listScopedUsers() xac dinh tai khoan nay co "thuoc ve" doi tac nay hay khong. */
async function createScopedUser({ username, password, fullName }, connectionId, createdBy) {
  const created = await userAdminService.createUser({ username, password, fullName, role: 0 }, createdBy);
  await userVoucherSystemService.setAllowedConnections(created.userId, [connectionId]);
  await permissionService.setCreatedByPartnerConnection(created.userId, connectionId);
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

/**
 * Sua ho ten/dat lai mat khau cho 1 tai khoan DA THUOC pham vi connectionId nay (v3.76) - tai
 * dung nguyen ven userAdminService.updateProfile() (ham quan tri day du dang dung), chi them
 * assertInScope() de dam bao doi tac khong sua duoc tai khoan ngoai pham vi cua ho.
 */
async function updateScopedUserProfile(userId, connectionId, { fullName, password }) {
  await assertInScope(userId, connectionId);
  await userAdminService.updateProfile(userId, { fullName, password });
}

/**
 * Doi quyen tinh nang (6 quyen) cho 1 tai khoan DA THUOC pham vi connectionId nay (v3.76).
 *
 * QUAN TRONG (chong leo thang dac quyen): ham nay CHI BUILD lai object perms tu DUNG 6 truong
 * ro rang liet ke duoi day - KHONG BAO GIO nhan/ghi truong `partnerAdminConnectionId` (quyen
 * "Quan tri doi tac") qua duong nay, du nguoi goi co co tinh gui kem truong do trong body hay
 * khong - tranh 1 doi tac tu cap quyen "Quan tri doi tac" cho 1 tai khoan khac (tao them 1 "doi
 * tac quan tri" ngang hang voi chinh ho). Muon gan/go quyen nay BAT BUOC phai qua man hinh "Tai
 * khoan" cua quan tri day du (user.controller.js#updatePartnerAdmin).
 */
async function updateScopedUserPermissions(userId, connectionId, perms, updatedBy) {
  await assertInScope(userId, connectionId);
  const safePerms = {
    canRedeemVoucher: !!perms.canRedeemVoucher,
    canViewReconciliation: !!perms.canViewReconciliation,
    canViewSummary: !!perms.canViewSummary,
    canViewUsedVouchers: !!perms.canViewUsedVouchers,
    canViewBusinessGuide: !!perms.canViewBusinessGuide,
    canViewSystemGuide: !!perms.canViewSystemGuide,
  };
  await permissionService.setPermissions(userId, safePerms, updatedBy);
  return safePerms;
}

/** Nem loi neu redemptionUnitId KHONG thuoc dung pham vi cua connectionId nay (ke thua "chu so
 * huu" qua CompanyId cua Don vi thu hoi - xem companyService.js#isOwnedByConnection, sql/038) -
 * bat buoc goi truoc khi gan 1 Don vi thu hoi cho tai khoan, tranh doi tac gan nham/co y gan diem
 * tieu cua HCRC hoac doi tac khac. Tra ve chinh Don vi thu hoi (da xac nhan thuoc pham vi). */
async function assertUnitOwnedByConnection(redemptionUnitId, connectionId) {
  const unit = await redemptionUnitService.getById(redemptionUnitId);
  if (!unit) throw badRequest('Khong tim thay Diem tieu da chon');
  const owned = await companyService.isOwnedByConnection(unit.CompanyId, connectionId);
  if (!owned) throw forbidden('Diem tieu nay khong thuoc pham vi quan tri cua ban');
  return unit;
}

/**
 * Gan/doi Diem tieu cho 1 tai khoan DA THUOC pham vi connectionId nay (v3.76). redemptionUnitId
 * rong = go diem tieu (Locations_Detail = NULL).
 *
 * BAT BUOC tai khoan dang CHI dung DUY NHAT he thong cua doi tac nay (exclusiveToThisSystem) -
 * giong het dieu kien cua setScopedUserActive() o tren. Tai khoan dang DUNG CHUNG them he thong
 * khac (vd duoc HCRC cap them quyen dung he thong HCRC) chi CHINH QUAN TRI DAY DU moi doi duoc
 * diem tieu - theo yeu cau nguoi dung: tranh doi tac vo tinh (hoac co y) gan nham 1 diem tieu cua
 * ho cho tai khoan dang lam viec chung cho ca 2 phia, trong khi chi HCRC moi co du boi canh ca
 * 2 he thong de biet diem tieu nao la dung.
 */
async function updateScopedUserLocation(userId, connectionId, redemptionUnitId) {
  const row = await assertInScope(userId, connectionId);
  if (!row.exclusiveToThisSystem) {
    throw forbidden(
      'Tai khoan nay dang duoc quan tri day du cap them quyen dung he thong khac - chi quan tri day du moi doi duoc diem tieu cua tai khoan nay.'
    );
  }
  let locationsDetail = null;
  if (redemptionUnitId) {
    const unit = await assertUnitOwnedByConnection(redemptionUnitId, connectionId);
    locationsDetail = unit.LocationDetailId ? await redemptionUnitService.getLocationCodeById(redemptionUnitId) : null;
  }
  await userAdminService.updateLocation(userId, locationsDetail);
}

/** Danh sach cong ty do CHINH doi tac nay tu tao (v3.76) - xem companyService.js#listByConnection. */
async function listOwnCompanies(connectionId) {
  return companyService.listByConnection(connectionId);
}

/** Tao 1 cong ty MOI, LUON danh dau CreatedByPartnerConnectionId = connectionId cua doi tac dang
 * tao (v3.76) - bo qua hoan toan gia tri nguoi goi co the gui len, dam bao cong ty moi tao luon
 * thuoc dung pham vi, hien ngay trong danh sach cua chinh doi tac do. */
async function createOwnCompany({ companyCode, companyName }, connectionId) {
  if (!companyCode || !String(companyCode).trim()) throw badRequest('Thieu ma cong ty');
  if (!companyName || !String(companyName).trim()) throw badRequest('Thieu ten cong ty');
  return companyService.create({
    companyCode: String(companyCode).trim(),
    companyName: String(companyName).trim(),
    createdByPartnerConnectionId: connectionId,
  });
}

/** Danh sach Diem tieu do CHINH doi tac nay tu tao (v3.76) - xem redemptionUnitService.js#listByConnection. */
async function listOwnUnits(connectionId) {
  return redemptionUnitService.listByConnection(connectionId);
}

/**
 * Tao 1 Diem tieu MOI cho doi tac (v3.76) - gop 2 buoc "Tao dia diem" + "Tao don vi thu hoi" cua
 * man hinh quan tri day du (units.js) thanh 1 buoc don gian hon cho doi tac: chi can nhap Ten diem
 * tieu + chon Cong ty (CUA CHINH HO). PartnerCode (ma noi bo, bat buoc UNIQUE tren RedemptionUnits)
 * duoc TU DONG sinh (khong bat doi tac tu nghi 1 ma rieng, tranh loi trung ma kho hieu).
 *
 * BAT BUOC companyId da chon phai THUOC DUNG pham vi doi tac nay (assertUnitOwnedByConnection
 * dung lai duoc o day qua companyService.isOwnedByConnection) - tranh doi tac gan diem tieu moi
 * vao 1 cong ty cua HCRC hoac doi tac khac.
 */
async function createOwnUnit({ locationName, companyId }, connectionId) {
  const trimmedName = locationName ? String(locationName).trim() : '';
  if (!trimmedName) throw badRequest('Thieu ten diem tieu');
  if (!companyId) throw badRequest('Thieu cong ty');

  const owned = await companyService.isOwnedByConnection(Number(companyId), connectionId);
  if (!owned) throw forbidden('Cong ty da chon khong thuoc pham vi quan tri cua ban');

  const location = await locationService.createDetail(trimmedName);
  // Ma noi bo (PartnerCode) UNIQUE toan he thong - sinh tu connectionId + id dia diem vua tao
  // (da la so nguyen DUY NHAT tuyet doi, xem locationService.js#createDetail) nen khong bao gio
  // trung, khong can kiem tra lai.
  const partnerCode = `P${connectionId}-${location.id}`;
  const unitId = await redemptionUnitService.create({
    locationDetailId: location.id,
    companyId: Number(companyId),
    partnerCode,
    partnerName: trimmedName,
  });
  return { id: unitId, locationDetailId: location.id, locationCode: location.locationCode, partnerCode };
}

module.exports = {
  listScopedUsers,
  assertInScope,
  createScopedUser,
  setScopedUserActive,
  removeOwnConnection,
  updateScopedUserProfile,
  updateScopedUserPermissions,
  updateScopedUserLocation,
  listOwnCompanies,
  createOwnCompany,
  listOwnUnits,
  createOwnUnit,
};
