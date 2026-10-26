const { sql, getPool } = require('../config/db');
const { runWithUniqueConstraintMessage } = require('../utils/sqlErrors');

async function list() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT Id, CompanyCode, CompanyName, ContactName, ContactPhone, ContactEmail,
           Address, TaxCode, BankAccount, BankName, Status, CreatedDate, UpdatedDate,
           CreatedByPartnerConnectionId
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
      SELECT Id, CompanyCode, CompanyName, Status, CreatedDate
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
             Address, TaxCode, BankAccount, BankName, Status
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
      .query(`
        INSERT INTO dbo.RedemptionCompanies
          (CompanyCode, CompanyName, ContactName, ContactPhone, ContactEmail,
           Address, TaxCode, BankAccount, BankName, Status, CreatedDate, CreatedByPartnerConnectionId)
        OUTPUT INSERTED.Id
        VALUES
          (@companyCode, @companyName, @contactName, @contactPhone, @contactEmail,
           @address, @taxCode, @bankAccount, @bankName, 1, GETDATE(), @createdByPartnerConnectionId)
      `);
    return result.recordset[0].Id;
  }, 'Ma cong ty (CompanyCode)');
}

async function update(id, data) {
  const pool = await getPool();
  // Dot ra soat sau phat hien: truoc day thieu CompanyCode trong SET - sua "ma cong ty" tren
  // giao dien bao thanh cong nhung du lieu that KHONG doi (chi cac truong khac duoc luu). Bat
  // loi vi pham UNIQUE (doi ma trung voi 1 cong ty khac) va doi thanh 1 thong bao 409 de hieu.
  await runWithUniqueConstraintMessage(
    () =>
      pool
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
        .input('status', sql.Bit, data.status === undefined ? 1 : data.status)
        .query(`
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
          WHERE Id = @id
        `),
    'Ma cong ty (CompanyCode)'
  );
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

  await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.ReportAccessGroupCompanies WHERE CompanyId = @id');
  await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.RedemptionCompanies WHERE Id = @id');
}

module.exports = { list, listByConnection, isOwnedByConnection, create, update, remove, getById };
