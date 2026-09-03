const { sql, getPool } = require('../config/db');

async function list() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      ru.Id, ru.LocationDetailId, ru.PartnerCode, ru.PartnerName, ru.ContactName,
      ru.ContactPhone, ru.ContactEmail, ru.Address, ru.TaxCode, ru.BankAccount,
      ru.BankName, ru.DailyLimitAmount, ru.Status, ru.CreatedDate, ru.UpdatedDate,
      LTRIM(RTRIM(d.LocationCode)) AS LocationCode,
      LTRIM(RTRIM(d.LocationName)) AS LocationName
    FROM dbo.RedemptionUnits ru
    INNER JOIN dbo.Locations_Detail d ON d.id = ru.LocationDetailId
    ORDER BY ru.PartnerName
  `);
  return result.recordset;
}

async function create(data) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('locationDetailId', sql.Int, data.locationDetailId)
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
        (LocationDetailId, PartnerCode, PartnerName, ContactName, ContactPhone,
         ContactEmail, Address, TaxCode, BankAccount, BankName, DailyLimitAmount, Status, CreatedDate)
      OUTPUT INSERTED.Id
      VALUES
        (@locationDetailId, @partnerCode, @partnerName, @contactName, @contactPhone,
         @contactEmail, @address, @taxCode, @bankAccount, @bankName, @dailyLimitAmount, 1, GETDATE())
    `);
  return result.recordset[0].Id;
}

async function update(id, data) {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
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

module.exports = { list, create, update };
