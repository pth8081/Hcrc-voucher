const { sql, getPool } = require('../config/db');
const { runWithUniqueConstraintMessage } = require('../utils/sqlErrors');
const redemptionUnitService = require('./redemptionUnitService');
const permissionService = require('./permissionService');
const userAdminService = require('./userAdminService');

/** 2 gia tri hop le cho CompanyType (xem sql/043) - REDEMPTION (mac dinh, "Cong ty thu hoi") va
 * PARTNER ("Cong ty doi tac", loai MOI theo yeu cau nguoi dung). */
const COMPANY_TYPES = ['REDEMPTION', 'PARTNER'];

function normalizeCompanyType(value) {
  const type = String(value || 'REDEMPTION').toUpperCase();
  return COMPANY_TYPES.includes(type) ? type : 'REDEMPTION';
}

async function list() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT Id, CompanyCode, CompanyName, ContactName, ContactPhone, ContactEmail,
           Address, TaxCode, BankAccount, BankName, Status, CreatedDate, UpdatedDate,
           CreatedByPartnerConnectionId, CompanyType
    FROM dbo.RedemptionCompanies
    ORDER BY CompanyName
  `);
  return result.recordset;
}

/** Danh sach cong ty do DUNG 1 doi tac (connectionId) tu tao - dung cho man hinh "Quan tri doi
 * tac" (xem partnerAdminService.js) - KHAC voi list() o tren (quan tri day du, thay TOAN BO ke
 * ca cong ty HCRC tao) - doi tac chi thay/chon duoc dung cong ty cua chinh ho, xem muc 18 README. */
async function listByConnection(connectionId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('connectionId', sql.Int, connectionId)
    .query(`
      SELECT Id, CompanyCode, CompanyName, Address, Status, CreatedDate, CompanyType
      FROM dbo.RedemptionCompanies
      WHERE CreatedByPartnerConnectionId = @connectionId
      ORDER BY CompanyName
    `);
  return result.recordset;
}

/** true neu cong ty (id) nay THUOC DUNG doi tac (connectionId) - dung de chan doi tac chon/gan
 * 1 cong ty KHONG phai cua ho (vd cong ty HCRC tao, hoac cua doi tac khac) khi tao Diem tieu moi -
 * xem partnerAdminService.js#createOwnUnit. */
async function isOwnedByConnection(companyId, connectionId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, companyId)
    .input('connectionId', sql.Int, connectionId)
    .query('SELECT 1 FROM dbo.RedemptionCompanies WHERE Id = @id AND CreatedByPartnerConnectionId = @connectionId');
  return !!result.recordset.length;
}

/** 1 cong ty theo id - dung de lay trang thai TRUOC KHI sua (audit log ghi ca before/after,
 * xem auditLogService.js). */
async function getById(id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query(`
      SELECT Id, CompanyCode, CompanyName, ContactName, ContactPhone, ContactEmail,
             Address, TaxCode, BankAccount, BankName, Status, CompanyType
      FROM dbo.RedemptionCompanies
      WHERE Id = @id
    `);
  return result.recordset[0] || null;
}

async function create(data) {
  const pool = await getPool();
  // Dot ra soat sau phat hien: CompanyCode co rang buoc UNIQUE nhung truoc day khong duoc
  // kiem tra o tang ung dung - nhap trung ma se bao loi 500 chung chung thay vi 1 thong bao ro
  // rang. Bat loi vi pham UNIQUE (neu co) va doi thanh 1 thong bao 409 de hieu.
  return runWithUniqueConstraintMessage(async () => {
    const result = await pool
      .request()
      .input('companyCode', sql.NVarChar(50), data.companyCode)
      .input('companyName', sql.NVarChar(300), data.companyName)
      .input('contactName', sql.NVarChar(200), data.contactName || null)
      .input('contactPhone', sql.NVarChar(40), data.contactPhone || null)
      .input('contactEmail', sql.NVarChar(200), data.contactEmail || null)
      .input('address', sql.NVarChar(500), data.address || null)
      .input('taxCode', sql.NVarChar(50), data.taxCode || null)
      .input('bankAccount', sql.NVarChar(100), data.bankAccount || null)
      .input('bankName', sql.NVarChar(200), data.bankName || null)
      // null (mac dinh) = tao qua man hinh quan tri day du (HCRC) - giu nguyen hanh vi cu. Co
      // gia tri = do CHINH doi tac nay tu tao qua man hinh "Quan tri doi tac" (xem
      // partnerAdminService.js#createOwnCompany), dung de loc lai dung pham vi cua ho sau nay.
      .input('createdByPartnerConnectionId', sql.Int, data.createdByPartnerConnectionId || null)
      // v3.94 (xem sql/043): mac dinh REDEMPTION ("Cong ty thu hoi") - giu nguyen hanh vi hien co.
      .input('companyType', sql.NVarChar(20), normalizeCompanyType(data.companyType))
      .query(`
        INSERT INTO dbo.RedemptionCompanies
          (CompanyCode, CompanyName, ContactName, ContactPhone, ContactEmail,
           Address, TaxCode, BankAccount, BankName, Status, CreatedDate, CreatedByPartnerConnectionId, CompanyType)
        OUTPUT INSERTED.Id
        VALUES
          (@companyCode, @companyName, @contactName, @contactPhone, @contactEmail,
           @address, @taxCode, @bankAccount, @bankName, 1, GETDATE(), @createdByPartnerConnectionId, @companyType)
      `);
    return result.recordset[0].Id;
  }, 'Ma cong ty (CompanyCode)');
}

/**
 * update() nhan them 2 THAM SO KHAC NHAU de gan "doi tac" cho 1 cong ty, dung o 2 man hinh khac
 * nhau (v3.81):
 *  - `createdByPartnerConnectionId` (co the undefined = KHONG doi, hoac gia tri/null = doi) - chi
 *    man hinh quan tri day du (units.html, xem company.controller.js#update) duoc gui truong nay,
 *    dung de HCRC gan/doi/go "thuoc doi tac nao" cho 1 cong ty (demo diem 4 - doi tac se tu thay
 *    cong ty nay trong man "Quan tri doi tac" cua ho ngay sau khi gan).
 *  - Man hinh "Quan tri doi tac" (partnerAdminService.js#updateOwnCompany) KHONG BAO GIO duoc
 *    gui truong nay (chi sua duoc thong tin cong ty cua chinh ho, khong tu doi duoc "chu so
 *    huu") - update() don gian BO QUA, khong dong gi den cot nay khi gia tri la `undefined`.
 */
/**
 * v3.94 (xem sql/043): data.companyType !== undefined -> doi loai cong ty. Chuyen SANG 'PARTNER'
 * (tu REDEMPTION, hoac lan dau dat) kich hoat CASCADE theo dung yeu cau nguoi dung - "Cong ty doi
 * tac" KHONG duoc co Diem tieu nao, tai khoan dang gan cong ty nay MAC DINH mat chuc nang thu
 * hoi: (1) go lien ket (KHONG xoa) toan bo Diem tieu dang gan vao cong ty nay -
 * redemptionUnitService.js#detachAllFromCompany; (2) ep CanRedeemVoucher = 0 va tu dong doi
 * thanh "Tai khoan doi tac" (IsPartnerAccount = 1) cho MOI tai khoan dang CompanyId toi cong ty
 * nay - permissionService.js#forcePartnerAccountForCompany. Chuyen NGUOC LAI (PARTNER ->
 * REDEMPTION) KHONG tu dong khoi phuc gi ca (Diem tieu/tai khoan phai gan/bat lai thu cong) - chi
 * mo lai KHA NANG gan Diem tieu cho cong ty nay.
 */
async function update(id, data, updatedBy) {
  const pool = await getPool();

  const current = data.companyType !== undefined ? await getById(id) : null;
  const isConvertingToPartner = current && current.CompanyType !== 'PARTNER' && normalizeCompanyType(data.companyType) === 'PARTNER';

  // Dot ra soat sau phat hien: truoc day thieu CompanyCode trong SET - sua "ma cong ty" tren
  // giao dien bao thanh cong nhung du lieu that KHONG doi (chi cac truong khac duoc luu). Bat
  // loi vi pham UNIQUE (doi ma trung voi 1 cong ty khac) va doi thanh 1 thong bao 409 de hieu.
  const setPartnerClause = data.createdByPartnerConnectionId !== undefined ? ', CreatedByPartnerConnectionId = @createdByPartnerConnectionId' : '';
  const setCompanyTypeClause = data.companyType !== undefined ? ', CompanyType = @companyType' : '';
  await runWithUniqueConstraintMessage(
    () => {
      const request = pool
        .request()
        .input('id', sql.Int, id)
        .input('companyCode', sql.NVarChar(50), data.companyCode)
        .input('companyName', sql.NVarChar(300), data.companyName)
        .input('contactName', sql.NVarChar(200), data.contactName || null)
        .input('contactPhone', sql.NVarChar(40), data.contactPhone || null)
        .input('contactEmail', sql.NVarChar(200), data.contactEmail || null)
        .input('address', sql.NVarChar(500), data.address || null)
        .input('taxCode', sql.NVarChar(50), data.taxCode || null)
        .input('bankAccount', sql.NVarChar(100), data.bankAccount || null)
        .input('bankName', sql.NVarChar(200), data.bankName || null)
        .input('status', sql.Bit, data.status === undefined ? 1 : data.status);
      if (data.createdByPartnerConnectionId !== undefined) {
        request.input('createdByPartnerConnectionId', sql.Int, data.createdByPartnerConnectionId || null);
      }
      if (data.companyType !== undefined) {
        request.input('companyType', sql.NVarChar(20), normalizeCompanyType(data.companyType));
      }
      return request.query(`
          UPDATE dbo.RedemptionCompanies SET
            CompanyCode = @companyCode,
            CompanyName = @companyName,
            ContactName = @contactName,
            ContactPhone = @contactPhone,
            ContactEmail = @contactEmail,
            Address = @address,
            TaxCode = @taxCode,
            BankAccount = @bankAccount,
            BankName = @bankName,
            Status = @status,
            UpdatedDate = GETDATE()
            ${setPartnerClause}
            ${setCompanyTypeClause}
          WHERE Id = @id
        `);
    },
    'Ma cong ty (CompanyCode)'
  );

  if (isConvertingToPartner) {
    // PHAI lay danh sach nay TRUOC khi detach (xem ghi chu redemptionUnitService.js#
    // listUserIdsByCompanyLocation) - gom ca tai khoan gan qua duong CU (Locations_Detail, da co
    // tu truoc khi co tinh nang nay) lan tai khoan tao qua duong MOI (CompanyId truc tiep, xem
    // sql/043) - khong chi rieng 1 trong 2, tranh bo sot tai khoan dang hoat dong that.
    const locationUserIds = await redemptionUnitService.listUserIdsByCompanyLocation(id);
    await redemptionUnitService.detachAllFromCompany(id);
    // Tai khoan da co CompanyId TRUC TIEP tro toi cong ty nay (vd tao qua man "Tai khoan"/"Quan
    // tri doi tac" moi) - 1 cau UPDATE gon, khong can vong lap.
    await permissionService.forcePartnerAccountForCompany(id, updatedBy);
    // Tai khoan CHI gan qua duong Locations_Detail (chua tung co CompanyId truc tiep) - gan luon
    // CompanyId cho ho (tu nay tro di co 1 nguon su that duy nhat), ep tat thu hoi, go Dia diem.
    for (const userId of locationUserIds) {
      await permissionService.setCompanyAndPartnerAccount(userId, { companyId: id, isPartnerAccount: true }, updatedBy);
      const before = await permissionService.getPermissions(userId);
      await permissionService.setPermissions(userId, { ...before, canRedeemVoucher: false }, updatedBy);
      await userAdminService.updateLocation(userId, null);
    }
  }
}

/** So Diem tieu + tai khoan se bi anh huong neu chuyen cong ty nay sang "Cong ty doi tac" - dung
 * de hien hop thoai xac nhan TRUOC khi thuc su chuyen (xem units.js/partner-admin.js).
 * accountCount PHAI gom CA 2 duong (UNION, dem DISTINCT UserID) - tai khoan gan TRUC TIEP qua
 * CompanyId (xem sql/043) VA tai khoan gan GIAN TIEP qua Locations_Detail (cach cu, da co tu
 * truoc) - giong het cach update() (o tren) thuc su xu ly khi CHUYEN, tranh hop thoai bao thieu
 * ("0 tai khoan") trong khi thuc te se co tai khoan bi tat chuc nang thu hoi. */
async function getConvertPreview(id) {
  const pool = await getPool();
  const [unitResult, accountResult] = await Promise.all([
    pool.request().input('id', sql.Int, id).query('SELECT COUNT(*) AS cnt FROM dbo.RedemptionUnits WHERE CompanyId = @id'),
    pool.request().input('id', sql.Int, id).query(`
      SELECT COUNT(*) AS cnt FROM (
        SELECT UserId AS UserID FROM dbo.VoucherAppPermissions WHERE CompanyId = @id
        UNION
        SELECT u.UserID
        FROM dbo.Users u
        INNER JOIN dbo.Locations_Detail d ON LTRIM(RTRIM(d.LocationCode)) = LTRIM(RTRIM(u.Locations_Detail))
        INNER JOIN dbo.RedemptionUnits ru ON ru.LocationDetailId = d.id
        WHERE ru.CompanyId = @id
      ) affected
    `),
  ]);
  return { unitCount: unitResult.recordset[0].cnt, accountCount: accountResult.recordset[0].cnt };
}

/**
 * Nem loi 400 neu KHONG the dat IsPartnerAccount = true cho 1 tai khoan dang gan companyId nay -
 * BAT BUOC companyId phai ton tai VA CompanyType = 'PARTNER' (xem sql/043), dung yeu cau nguoi
 * dung "tai khoan chuyen thanh doi tac buoc phai thuoc 1 cong ty doi tac, neu chua phai thong bao
 * de admin biet chuyen cong ty truoc". Dung chung boi userAdminService.js (man "Tai khoan") va
 * partnerAdminService.js (man "Quan tri doi tac").
 */
async function assertCanBePartnerAccount(companyId) {
  if (!companyId) {
    const err = new Error('Tai khoan chua gan Cong ty, khong the chuyen thanh Tai khoan doi tac');
    err.statusCode = 400;
    err.publicMessage = 'Tài khoản này chưa gán công ty nào - vui lòng gán tài khoản vào 1 "Công ty đối tác" trước, hoặc chuyển công ty hiện tại của tài khoản thành "Công ty đối tác" (ở màn "Đơn vị thu hồi"/"Quản trị đối tác") rồi thử lại.';
    throw err;
  }
  const company = await getById(companyId);
  if (!company || company.CompanyType !== 'PARTNER') {
    const err = new Error('Cong ty cua tai khoan nay khong phai Cong ty doi tac');
    err.statusCode = 400;
    err.publicMessage = `Tài khoản này đang thuộc công ty "${company ? company.CompanyName : '(không xác định)'}" - công ty này chưa phải "Công ty đối tác". Vui lòng chuyển công ty này thành "Công ty đối tác" trước (ở màn "Đơn vị thu hồi"/"Quản trị đối tác"), hoặc gán tài khoản sang 1 công ty đối tác khác, rồi thử lại.`;
    throw err;
  }
}

/** Xoa 1 cong ty - CHAN neu con Don vi thu hoi (diem tieu) nao dang gan vao cong ty nay
 * (RedemptionUnits.CompanyId co FK toi bang nay, xem sql/010), tra ve loi 409 ro rang thay vi
 * de SQL Server nem loi vi pham FK kho hieu. Theo dung yeu cau: phai xoa/chuyen het diem tieu
 * truoc khi xoa duoc cong ty. Don gian xoa truoc cac dong "duoc xem them" cua Nhom quyen bao
 * cao (ReportAccessGroupCompanies) tro toi cong ty nay - day chi la 1 tuy chon hien thi, khong
 * phai du lieu nghiep vu that, xoa an toan khong can hoi. */
async function remove(id) {
  const pool = await getPool();

  const unitCount = await pool
    .request()
    .input('id', sql.Int, id)
    .query('SELECT COUNT(*) AS cnt FROM dbo.RedemptionUnits WHERE CompanyId = @id');
  const count = unitCount.recordset[0].cnt;
  if (count > 0) {
    const err = new Error('Cong ty con diem tieu, khong the xoa');
    err.statusCode = 409;
    err.publicMessage = `Công ty này đang có ${count} điểm tiêu gắn vào - vui lòng xóa hoặc chuyển hết điểm tiêu sang công ty khác trước khi xóa công ty.`;
    throw err;
  }

  // v3.94 (xem sql/043): "Cong ty doi tac" khong co Diem tieu nen khong bi chan boi dieu kien tren -
  // can them dieu kien rieng chan xoa khi con tai khoan dang gan TRUC TIEP (CompanyId) vao cong
  // ty nay, tranh de lai 1 CompanyId "treo" vao 1 cong ty da bi xoa.
  const accountCount = await pool
    .request()
    .input('id', sql.Int, id)
    .query('SELECT COUNT(*) AS cnt FROM dbo.VoucherAppPermissions WHERE CompanyId = @id');
  const accCount = accountCount.recordset[0].cnt;
  if (accCount > 0) {
    const err = new Error('Cong ty con tai khoan dang gan, khong the xoa');
    err.statusCode = 409;
    err.publicMessage = `Công ty này đang có ${accCount} tài khoản gắn vào - vui lòng chuyển các tài khoản đó sang công ty khác trước khi xóa công ty.`;
    throw err;
  }

  await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.ReportAccessGroupCompanies WHERE CompanyId = @id');
  await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.RedemptionCompanies WHERE Id = @id');
}

module.exports = { list, listByConnection, isOwnedByConnection, create, update, remove, getById, getConvertPreview, assertCanBePartnerAccount };
