const { sql, getPool } = require('../config/db');
const { runWithUniqueConstraintMessage } = require('../utils/sqlErrors');

async function list() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT Id, CompanyCode, CompanyName, ContactName, ContactPhone, ContactEmail,
           Address, TaxCode, BankAccount, BankName, Status, CreatedDate, UpdatedDate
    FROM dbo.RedemptionCompanies
    ORDER BY CompanyName
  `);
  return result.recordset;
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
      .query(`
        INSERT INTO dbo.RedemptionCompanies
          (CompanyCode, CompanyName, ContactName, ContactPhone, ContactEmail,
           Address, TaxCode, BankAccount, BankName, Status, CreatedDate)
        OUTPUT INSERTED.Id
        VALUES
          (@companyCode, @companyName, @contactName, @contactPhone, @contactEmail,
           @address, @taxCode, @bankAccount, @bankName, 1, GETDATE())
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

module.exports = { list, create, update, getById };
