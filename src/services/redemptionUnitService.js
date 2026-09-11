const { sql, getPool } = require('../config/db');

async function list() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      ru.Id, ru.LocationDetailId, ru.PartnerCode, ru.PartnerName, ru.ContactName,
      ru.ContactPhone, ru.ContactEmail, ru.Address, ru.TaxCode, ru.BankAccount,
      ru.BankName, ru.DailyLimitAmount, ru.Status, ru.CreatedDate, ru.UpdatedDate,
      ru.CompanyId, c.CompanyName,
      LTRIM(RTRIM(d.LocationCode)) AS LocationCode,
      LTRIM(RTRIM(d.LocationName)) AS LocationName
    FROM dbo.RedemptionUnits ru
    INNER JOIN dbo.Locations_Detail d ON d.id = ru.LocationDetailId
    LEFT JOIN dbo.RedemptionCompanies c ON c.Id = ru.CompanyId
    ORDER BY c.CompanyName, ru.PartnerName
  `);
  return result.recordset;
}

/** Tra ve LocationCode (Locations_Detail.LocationCode, da trim) cua 1 Don vi thu hoi - dung de
 * gan tai khoan truc tiep vao dung diem tieu (xem userAdminService.js), tranh phai go tay ma. */
async function getLocationCodeById(id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query(`
      SELECT LTRIM(RTRIM(d.LocationCode)) AS LocationCode
      FROM dbo.RedemptionUnits ru
      INNER JOIN dbo.Locations_Detail d ON d.id = ru.LocationDetailId
      WHERE ru.Id = @id
    `);
  return result.recordset[0]?.LocationCode || null;
}

/** 1 Don vi thu hoi theo id - dung de lay trang thai TRUOC KHI sua (audit log ghi ca
 * before/after, xem auditLogService.js). */
async function getById(id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query(`
      SELECT Id, LocationDetailId, CompanyId, PartnerCode, PartnerName, ContactName, ContactPhone,
             ContactEmail, Address, TaxCode, BankAccount, BankName, DailyLimitAmount, Status
      FROM dbo.RedemptionUnits
      WHERE Id = @id
    `);
  return result.recordset[0] || null;
}

async function create(data) {
  const pool = await getPool();

  // LocationDetailId KHONG co FK toi Locations_Detail (bang dung chung voi Core, xem
  // sql/001_create_redemption_units.sql) - tu kiem tra ton tai o day de tranh go nham ma tao
  // ra 1 diem tieu "ma" (khong lien ket duoc voi dia diem nao, se khong hien o bat ky bao cao
  // nao vi cac truy van deu JOIN qua Locations_Detail).
  const locationCheck = await pool
    .request()
    .input('locationDetailId', sql.Int, data.locationDetailId)
    .query('SELECT 1 FROM dbo.Locations_Detail WHERE id = @locationDetailId');
  if (!locationCheck.recordset.length) {
    const err = new Error('locationDetailId khong ton tai trong Locations_Detail');
    err.statusCode = 400;
    err.publicMessage = 'Dia diem (Locations_Detail) da chon khong ton tai, vui long chon lai';
    throw err;
  }

  // C4: bang Locations_Detail (dung chung voi Core, KHONG duoc sua cau truc) co the co nhieu
  // dong TRUNG LocationCode (da gap that o du lieu that - xem migration/fix bao cao trung
  // dong truoc day). Neu 2 dong trung ma nay bi gan cho 2 CONG TY khac nhau qua 2 Don vi thu
  // hoi khac nhau, thi resolveVisibleLocationCodes (reportAccessService.js) se tra ve CUNG 1
  // ma cho ca 2 cong ty -> tai khoan cong ty A nhin thay duoc du lieu VOUCHER_SYNC cua cong ty
  // B va nguoc lai (ro ri du lieu tai chinh xuyen cong ty). Chan tu luc tao/gan de khong bao
  // gio xay ra tinh huong nay qua giao dien app.
  const conflictCheck = await pool
    .request()
    .input('locationDetailId', sql.Int, data.locationDetailId)
    .input('companyId', sql.Int, data.companyId)
    .query(`
      SELECT TOP 1 c.CompanyName
      FROM dbo.RedemptionUnits ru2
      INNER JOIN dbo.Locations_Detail d1 ON d1.id = ru2.LocationDetailId
      LEFT JOIN dbo.RedemptionCompanies c ON c.Id = ru2.CompanyId
      WHERE LTRIM(RTRIM(d1.LocationCode)) = (
              SELECT LTRIM(RTRIM(LocationCode)) FROM dbo.Locations_Detail WHERE id = @locationDetailId
            )
        AND (
              (ru2.CompanyId IS NOT NULL AND @companyId IS NOT NULL AND ru2.CompanyId <> @companyId)
              OR (ru2.CompanyId IS NULL AND @companyId IS NOT NULL)
              OR (ru2.CompanyId IS NOT NULL AND @companyId IS NULL)
            )
    `);
  if (conflictCheck.recordset.length) {
    const conflictCompany = conflictCheck.recordset[0].CompanyName || '(chua gan cong ty)';
    const err = new Error('LocationCode trung voi don vi thu hoi cua cong ty khac');
    err.statusCode = 400;
    err.publicMessage = `Dia diem nay dang trung ma voi 1 dia diem khac da gan cho cong ty "${conflictCompany}" (du lieu Locations_Detail bi trung ma). De tranh cac tai khoan cua 2 cong ty nhin thay bao cao cua nhau, vui long chon dung dia diem cua cong ty hien tai, hoac lien he IT kiem tra du lieu Locations_Detail bi trung.`;
    throw err;
  }

  const result = await pool
    .request()
    .input('locationDetailId', sql.Int, data.locationDetailId)
    .input('companyId', sql.Int, data.companyId)
    .input('partnerCode', sql.NVarChar(50), data.partnerCode)
    .input('partnerName', sql.NVarChar(300), data.partnerName)
    .input('contactName', sql.NVarChar(200), data.contactName || null)
    .input('contactPhone', sql.NVarChar(40), data.contactPhone || null)
    .input('contactEmail', sql.NVarChar(200), data.contactEmail || null)
    .input('address', sql.NVarChar(500), data.address || null)
    .input('taxCode', sql.NVarChar(50), data.taxCode || null)
    .input('bankAccount', sql.NVarChar(100), data.bankAccount || null)
    .input('bankName', sql.NVarChar(200), data.bankName || null)
    .input('dailyLimitAmount', sql.Numeric(18, 2), data.dailyLimitAmount || null)
    .query(`
      INSERT INTO dbo.RedemptionUnits
        (LocationDetailId, CompanyId, PartnerCode, PartnerName, ContactName, ContactPhone,
         ContactEmail, Address, TaxCode, BankAccount, BankName, DailyLimitAmount, Status, CreatedDate)
      OUTPUT INSERTED.Id
      VALUES
        (@locationDetailId, @companyId, @partnerCode, @partnerName, @contactName, @contactPhone,
         @contactEmail, @address, @taxCode, @bankAccount, @bankName, @dailyLimitAmount, 1, GETDATE())
    `);
  return result.recordset[0].Id;
}

async function update(id, data) {
  const pool = await getPool();

  // C4 (xem giai thich chi tiet o create() phia tren): khi doi cong ty cua 1 don vi thu hoi
  // co san, kiem tra lai cung dieu kien - LocationCode cua don vi nay khong duoc trung voi
  // don vi cua 1 cong ty KHAC.
  const conflictCheck = await pool
    .request()
    .input('id', sql.Int, id)
    .input('companyId', sql.Int, data.companyId)
    .query(`
      SELECT TOP 1 c.CompanyName
      FROM dbo.RedemptionUnits ru2
      INNER JOIN dbo.Locations_Detail d1 ON d1.id = ru2.LocationDetailId
      LEFT JOIN dbo.RedemptionCompanies c ON c.Id = ru2.CompanyId
      WHERE ru2.Id <> @id
        AND LTRIM(RTRIM(d1.LocationCode)) = (
              SELECT LTRIM(RTRIM(d0.LocationCode))
              FROM dbo.RedemptionUnits ru0
              INNER JOIN dbo.Locations_Detail d0 ON d0.id = ru0.LocationDetailId
              WHERE ru0.Id = @id
            )
        AND (
              (ru2.CompanyId IS NOT NULL AND @companyId IS NOT NULL AND ru2.CompanyId <> @companyId)
              OR (ru2.CompanyId IS NULL AND @companyId IS NOT NULL)
              OR (ru2.CompanyId IS NOT NULL AND @companyId IS NULL)
            )
    `);
  if (conflictCheck.recordset.length) {
    const conflictCompany = conflictCheck.recordset[0].CompanyName || '(chua gan cong ty)';
    const err = new Error('LocationCode trung voi don vi thu hoi cua cong ty khac');
    err.statusCode = 400;
    err.publicMessage = `Dia diem cua don vi nay dang trung ma voi 1 dia diem khac da gan cho cong ty "${conflictCompany}". De tranh cac tai khoan cua 2 cong ty nhin thay bao cao cua nhau, vui long kiem tra lai truoc khi doi cong ty.`;
    throw err;
  }

  await pool
    .request()
    .input('id', sql.Int, id)
    .input('companyId', sql.Int, data.companyId)
    // Dot ra soat sau phat hien: truoc day thieu PartnerCode trong SET - sua "ma doi tac" tren
    // giao dien bao thanh cong nhung du lieu that KHONG doi (chi cac truong khac duoc luu).
    .input('partnerCode', sql.NVarChar(50), data.partnerCode)
    .input('partnerName', sql.NVarChar(300), data.partnerName)
    .input('contactName', sql.NVarChar(200), data.contactName || null)
    .input('contactPhone', sql.NVarChar(40), data.contactPhone || null)
    .input('contactEmail', sql.NVarChar(200), data.contactEmail || null)
    .input('address', sql.NVarChar(500), data.address || null)
    .input('taxCode', sql.NVarChar(50), data.taxCode || null)
    .input('bankAccount', sql.NVarChar(100), data.bankAccount || null)
    .input('bankName', sql.NVarChar(200), data.bankName || null)
    .input('dailyLimitAmount', sql.Numeric(18, 2), data.dailyLimitAmount || null)
    .input('status', sql.Bit, data.status === undefined ? 1 : data.status)
    .query(`
      UPDATE dbo.RedemptionUnits SET
        CompanyId = @companyId,
        PartnerCode = @partnerCode,
        PartnerName = @partnerName,
        ContactName = @contactName,
        ContactPhone = @contactPhone,
        ContactEmail = @contactEmail,
        Address = @address,
        TaxCode = @taxCode,
        BankAccount = @bankAccount,
        BankName = @bankName,
        DailyLimitAmount = @dailyLimitAmount,
        Status = @status,
        UpdatedDate = GETDATE()
      WHERE Id = @id
    `);
}

module.exports = { list, create, update, getLocationCodeById, getById };
