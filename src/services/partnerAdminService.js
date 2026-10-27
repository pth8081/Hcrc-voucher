const userAdminService = require('./userAdminService');
const userScheduleService = require('./userScheduleService');
const userVoucherSystemService = require('./userVoucherSystemService');
const permissionService = require('./permissionService');
const companyService = require('./companyService');
const redemptionUnitService = require('./redemptionUnitService');
const locationService = require('./locationService');
const reportAccessService = require('./reportAccessService');

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
  const [withSchedule, voucherSystemsByUserId, createdByPartnerByUserId, reportAccessByUserId] = await Promise.all([
    userScheduleService.listAllWithSchedule(true), // true = gom ca tai khoan da xoa mem, de doi tac tu khoi phuc lai duoc chinh tai khoan ho da tao
    userVoucherSystemService.listUserAccess(),
    permissionService.listCreatedByPartnerConnection(),
    reportAccessService.listUserAccess(),
  ]);
  const reportAccessMap = new Map(reportAccessByUserId.map((a) => [a.userId, a]));

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
      // v3.81 (diem 8/9): nhom quyen xem bao cao HIEN TAI - chi co the la nhom DO CHINH doi tac
      // nay tao (updateScopedUserReportAccessGroup() da chan gan nhom cua nguoi khac), nen o day
      // khong can loc/kiem tra lai "chu so huu" cua nhom - chi tra thang de man "Sua tai khoan"
      // hien ro va chon san.
      reportAccessGroupId: reportAccessMap.get(u.userId)?.groupId || null,
      reportAccessGroupName: reportAccessMap.get(u.userId)?.groupName || null,
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
 * cu de listScopedUsers() xac dinh tai khoan nay co "thuoc ve" doi tac nay hay khong.
 *
 * redemptionUnitId (v3.81, diem 1): gan LUON Diem tieu ngay luc tao neu co chon - truoc day phai
 * tao xong roi vao "Sua tai khoan" moi gan duoc. Dung lai assertUnitOwnedByConnection() (dinh
 * nghia o duoi) de dam bao diem tieu da chon THUOC DUNG pham vi doi tac nay (cua chinh ho tu tao,
 * hoac do HCRC tao va gan rieng cho ho - ca 2 deu di qua CHUNG 1 dieu kien "chu so huu").
 */
async function createScopedUser({ username, password, fullName, redemptionUnitId }, connectionId, createdBy) {
  const created = await userAdminService.createUser({ username, password, fullName, role: 0 }, createdBy);
  await userVoucherSystemService.setAllowedConnections(created.userId, [connectionId]);
  await permissionService.setCreatedByPartnerConnection(created.userId, connectionId);
  if (redemptionUnitId) {
    const unit = await assertUnitOwnedByConnection(Number(redemptionUnitId), connectionId);
    const locationsDetail = unit.LocationDetailId ? await redemptionUnitService.getLocationCodeById(Number(redemptionUnitId)) : null;
    await userAdminService.updateLocation(created.userId, locationsDetail);
  }
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
 * Doi quyen tinh nang (7 quyen, them "Lich gui email bao cao" o v3.84) cho 1 tai khoan DA THUOC
 * pham vi connectionId nay (v3.76).
 *
 * QUAN TRONG (chong leo thang dac quyen): ham nay CHI BUILD lai object perms tu DUNG 7 truong
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
    canManageEmailSchedules: !!perms.canManageEmailSchedules,
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

/**
 * Gan/doi "Nhom quyen xem bao cao" cho 1 tai khoan DA THUOC pham vi connectionId nay (v3.81,
 * diem 8/9). groupId rong = go khoi nhom (ve mac dinh: chi xem cong ty cua diem tieu dang gan).
 *
 * BAT BUOC ca 2 dieu kien: (1) tai khoan dang CHI dung DUY NHAT he thong cua doi tac nay
 * (exclusiveToThisSystem) - CUNG ly do voi updateScopedUserLocation() o tren (tranh doi tac vo
 * tinh/co y mo rong pham vi xem bao cao cho 1 tai khoan dang lam viec chung ca 2 phia); (2) nhom
 * quyen da chon phai DO CHINH doi tac nay tao (assertReportAccessGroupOwnedByConnection, dinh
 * nghia cung section voi cac ham quan tri nhom quyen ben duoi) - tranh gan nham/co y gan 1 nhom
 * quyen cua HCRC hoac doi tac khac (se khong resolve duoc dung vi dieu kien loc o day, nhung van
 * nen chan tu som cho ro rang thay vi de "gan duoc nhung khong co tac dung").
 */
async function updateScopedUserReportAccessGroup(userId, connectionId, groupId, updatedBy) {
  const row = await assertInScope(userId, connectionId);
  if (!row.exclusiveToThisSystem) {
    throw forbidden(
      'Tai khoan nay dang duoc quan tri day du cap them quyen dung he thong khac - chi quan tri day du moi doi duoc nhom quyen xem bao cao cua tai khoan nay.'
    );
  }
  if (groupId) {
    await assertReportAccessGroupOwnedByConnection(Number(groupId), connectionId);
  }
  await reportAccessService.setUserGroup(userId, groupId ? Number(groupId) : null, updatedBy);
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

/**
 * Sua 1 cong ty DA THUOC pham vi connectionId nay (v3.81, diem 3 - "toan quyen quan ly"). Dung
 * CHUNG 1 dieu kien "chu so huu" voi isOwnedByConnection (CreatedByPartnerConnectionId = connectionId)
 * cho CA 2 truong hop: cong ty do CHINH doi tac nay tu tao, VA cong ty do HCRC tao roi GAN cho ho
 * (diem 4, qua company.controller.js#update) - ca 2 deu cho DOI TAC TOAN QUYEN sua/xoa ngay khi
 * thuoc pham vi cua ho, dung yeu cau nguoi dung ("doi tac phai toan quyen quan ly") - khong phan
 * biet rieng "ai la nguoi tao ban dau", vi du lieu khong luu rieng thong tin do.
 *
 * KHONG BAO GIO nhan/ghi `createdByPartnerConnectionId` qua duong nay (chi liet ke ro 2 truong
 * duoc sua: companyCode, companyName) - tranh doi tac tu doi "chu so huu" cua chinh cong ty minh
 * dang sua (vd tu nhan cong ty do la cua doi tac khac, hoac tu "tra lai" cho HCRC).
 */
async function updateOwnCompany(id, { companyCode, companyName }, connectionId) {
  const owned = await companyService.isOwnedByConnection(Number(id), connectionId);
  if (!owned) throw forbidden('Cong ty nay khong thuoc pham vi quan ly cua ban');
  if (!companyCode || !String(companyCode).trim()) throw badRequest('Thieu ma cong ty');
  if (!companyName || !String(companyName).trim()) throw badRequest('Thieu ten cong ty');
  await companyService.update(Number(id), { companyCode: String(companyCode).trim(), companyName: String(companyName).trim() });
}

/** Xoa 1 cong ty DA THUOC pham vi connectionId nay (v3.81, diem 3) - dieu kien "chu so huu" giong
 * het updateOwnCompany(). companyService.remove() tu chan neu con diem tieu gan vao (409). */
async function removeOwnCompany(id, connectionId) {
  const owned = await companyService.isOwnedByConnection(Number(id), connectionId);
  if (!owned) throw forbidden('Cong ty nay khong thuoc pham vi quan ly cua ban');
  await companyService.remove(Number(id));
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

/**
 * Sua 1 Diem tieu DA THUOC pham vi connectionId nay (v3.81, diem 3) - chi cho sua Ten diem tieu +
 * doi Cong ty (giong dung 2 truong form "Tao diem tieu" o tren), giu nguyen moi truong khac
 * (PartnerCode, lien he, han muc...) nhu luc tao - doi tac khong can/khong thay cac truong do o
 * day. Cong ty MOI chon (neu doi) cung phai THUOC DUNG pham vi doi tac nay.
 */
async function updateOwnUnit(id, { locationName, companyId }, connectionId) {
  const existing = await assertUnitOwnedByConnection(Number(id), connectionId);
  const trimmedName = locationName ? String(locationName).trim() : '';
  if (!trimmedName) throw badRequest('Thieu ten diem tieu');
  const targetCompanyId = companyId ? Number(companyId) : existing.CompanyId;
  const owned = await companyService.isOwnedByConnection(targetCompanyId, connectionId);
  if (!owned) throw forbidden('Cong ty da chon khong thuoc pham vi quan tri cua ban');
  await redemptionUnitService.update(Number(id), {
    locationDetailId: existing.LocationDetailId,
    companyId: targetCompanyId,
    partnerCode: existing.PartnerCode,
    partnerName: trimmedName,
    contactName: existing.ContactName,
    contactPhone: existing.ContactPhone,
    contactEmail: existing.ContactEmail,
    address: existing.Address,
    taxCode: existing.TaxCode,
    bankAccount: existing.BankAccount,
    bankName: existing.BankName,
    dailyLimitAmount: existing.DailyLimitAmount,
    status: existing.Status,
  });
}

/** Xoa 1 Diem tieu DA THUOC pham vi connectionId nay (v3.81, diem 3) - redemptionUnitService.remove()
 * tu chan neu con nhan vien dang hoat dong gan vao (409). */
async function removeOwnUnit(id, connectionId) {
  await assertUnitOwnedByConnection(Number(id), connectionId);
  await redemptionUnitService.remove(Number(id));
}

/** Nem loi 403 neu nhom quyen (groupId) nay KHONG thuoc dung pham vi cua connectionId nay - xem
 * reportAccessService.js#isGroupOwnedByConnection. */
async function assertReportAccessGroupOwnedByConnection(groupId, connectionId) {
  const owned = await reportAccessService.isGroupOwnedByConnection(groupId, connectionId);
  if (!owned) throw forbidden('Nhom quyen nay khong thuoc pham vi quan tri cua ban');
}

/** Danh sach "Nhom quyen xem bao cao" do CHINH doi tac nay tu tao (v3.81, diem 8/9) - xem
 * reportAccessService.js#listGroupsByConnection. */
async function listOwnReportAccessGroups(connectionId) {
  return reportAccessService.listGroupsByConnection(connectionId);
}

/** Kiem tra + chuan hoa (groupName, scopeType, companyIds) dung chung cho tao/sua nhom quyen cua
 * doi tac - BAT BUOC moi companyId (khi SPECIFIC) phai THUOC DUNG pham vi doi tac nay, tranh ho
 * cap quyen xem cheo sang cong ty cua HCRC/doi tac khac qua nhom quyen tu tao. */
async function validateOwnGroupInput({ groupName, scopeType, companyIds }, connectionId) {
  if (!groupName || !String(groupName).trim()) throw badRequest('Thieu ten nhom quyen');
  if (!['ALL', 'SPECIFIC'].includes(scopeType)) throw badRequest('Pham vi khong hop le (phai la ALL hoac SPECIFIC)');
  if (scopeType !== 'SPECIFIC') return { groupName: String(groupName).trim(), scopeType, companyIds: [] };
  if (!Array.isArray(companyIds) || !companyIds.length) throw badRequest('Pham vi "chi xem them 1 so cong ty" phai chon it nhat 1 cong ty');
  for (const companyId of companyIds) {
    const owned = await companyService.isOwnedByConnection(Number(companyId), connectionId);
    if (!owned) throw forbidden('1 trong cac cong ty da chon khong thuoc pham vi quan tri cua ban');
  }
  return { groupName: String(groupName).trim(), scopeType, companyIds: companyIds.map(Number) };
}

/** Tao 1 "Nhom quyen xem bao cao" MOI, LUON danh dau CreatedByPartnerConnectionId = connectionId
 * (v3.81, diem 8/9) - xem ghi chu bao mat o reportAccessService.js#resolveVisibleLocationCodes ve
 * y nghia rieng cua ScopeType='ALL' cho nhom quyen co chu la doi tac (CHI tinh cong ty cua DUNG
 * doi tac do, khong bao gio la "toan bo he thong"). */
async function createOwnReportAccessGroup(input, connectionId) {
  const safe = await validateOwnGroupInput(input, connectionId);
  return reportAccessService.createGroup({ ...safe, createdByPartnerConnectionId: connectionId });
}

/** Sua 1 "Nhom quyen xem bao cao" DA THUOC pham vi connectionId nay (v3.81, diem 8/9). */
async function updateOwnReportAccessGroup(id, input, connectionId) {
  await assertReportAccessGroupOwnedByConnection(Number(id), connectionId);
  const safe = await validateOwnGroupInput(input, connectionId);
  await reportAccessService.updateGroup(Number(id), safe);
}

/** Xoa 1 "Nhom quyen xem bao cao" DA THUOC pham vi connectionId nay (v3.81, diem 8/9) -
 * reportAccessService.removeGroup() tu chan neu con tai khoan dang gan (409). */
async function removeOwnReportAccessGroup(id, connectionId) {
  await assertReportAccessGroupOwnedByConnection(Number(id), connectionId);
  await reportAccessService.removeGroup(Number(id));
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
  updateScopedUserReportAccessGroup,
  listOwnCompanies,
  createOwnCompany,
  updateOwnCompany,
  removeOwnCompany,
  listOwnUnits,
  createOwnUnit,
  updateOwnUnit,
  removeOwnUnit,
  listOwnReportAccessGroups,
  createOwnReportAccessGroup,
  updateOwnReportAccessGroup,
  removeOwnReportAccessGroup,
};
