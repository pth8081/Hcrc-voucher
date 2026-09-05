const { sql, getPool } = require('../config/db');

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

async function create(data) {
  const pool = await getPool();
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
}

async function update(id, data) {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
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
    `);
}

module.exports = { list, create, update };
