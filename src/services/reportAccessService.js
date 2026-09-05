const { sql, getPool } = require('../config/db');

/**
 * Phan quyen xem bao cao THEO CONG TY - tach biet hoan toan voi Users.status (vai tro quan
 * tri he thong: cau hinh Core API/2FA...). Mac dinh (khong o trong nhom quyen nao) = chi xem
 * dung dia diem cua chinh minh. Vao 1 "nhom quyen" (ReportAccessGroups) moi duoc xem THEM
 * cong ty khac (ScopeType='SPECIFIC', liet ke tung cong ty) hoac xem TOAN BO (ScopeType='ALL').
 */

async function getUserGroup(userId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT g.Id AS groupId, g.ScopeType AS scopeType
      FROM dbo.UserReportAccess a
      INNER JOIN dbo.ReportAccessGroups g ON g.Id = a.GroupId
      WHERE a.UserId = @userId
    `);
  return result.recordset[0] || null;
}

async function getGroupCompanyIds(groupId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('groupId', sql.Int, groupId)
    .query('SELECT CompanyId FROM dbo.ReportAccessGroupCompanies WHERE GroupId = @groupId');
  return result.recordset.map((r) => r.CompanyId);
}

/** Ma dia diem (LocationCode, da trim) cua toan bo diem tieu thuoc 1 danh sach cong ty. */
async function getLocationCodesForCompanies(companyIds) {
  if (!companyIds.length) return [];
  const pool = await getPool();
  const request = pool.request();
  const placeholders = companyIds.map((id, i) => {
    request.input(`companyId${i}`, sql.Int, id);
    return `@companyId${i}`;
  });
  const result = await request.query(`
    SELECT DISTINCT LTRIM(RTRIM(d.LocationCode)) AS LocationCode
    FROM dbo.RedemptionUnits ru
    INNER JOIN dbo.Locations_Detail d ON d.id = ru.LocationDetailId
    WHERE ru.CompanyId IN (${placeholders.join(', ')})
  `);
  return result.recordset.map((r) => r.LocationCode);
}

/**
 * Tinh pham vi dia diem 1 tai khoan duoc xem trong bao cao.
 * Tra ve { scope: 'all' } (khong loc gi ca) hoac { scope: 'own'|'specific', codes: string[] }.
 *
 * Tai khoan QUAN TRI HE THONG (Users.status = 1, role=1) quan ly toan bo cong ty/diem tieu nen
 * MAC DINH duoc xem TOAN BO bao cao, giong hanh vi truoc khi co tinh nang phan quyen nay - nhom
 * quyen o day chi de HAN CHE lai 1 admin cu the neu can (gan nhom SPECIFIC cho admin do), khong
 * phai buoc admin phai duoc cap quyen moi xem duoc.
 */
async function resolveVisibleLocationCodes({ userId, ownLocationsDetail, role }) {
  const ownCode = ownLocationsDetail ? String(ownLocationsDetail).trim() : null;
  const group = await getUserGroup(userId);

  if (!group) {
    if (Number(role) === 1) {
      return { scope: 'all', codes: null };
    }
    return { scope: 'own', codes: ownCode ? [ownCode] : [] };
  }
  if (group.scopeType === 'ALL') {
    return { scope: 'all', codes: null };
  }

  const companyIds = await getGroupCompanyIds(group.groupId);
  const codesFromCompanies = await getLocationCodesForCompanies(companyIds);
  const codes = Array.from(new Set([ownCode, ...codesFromCompanies].filter(Boolean)));
  return { scope: 'specific', codes };
}

// =====================================================================
// Quan tri nhom quyen (chi admin)
// =====================================================================

async function listGroups() {
  const pool = await getPool();
  const groups = (
    await pool.request().query(`
      SELECT Id, GroupName, ScopeType, CreatedDate, UpdatedDate
      FROM dbo.ReportAccessGroups
      ORDER BY GroupName
    `)
  ).recordset;

  const companyRows = (
    await pool.request().query(`
      SELECT gc.GroupId, gc.CompanyId, c.CompanyName
      FROM dbo.ReportAccessGroupCompanies gc
      INNER JOIN dbo.RedemptionCompanies c ON c.Id = gc.CompanyId
    `)
  ).recordset;

  return groups.map((g) => ({
    ...g,
    companies: companyRows.filter((c) => c.GroupId === g.Id).map((c) => ({ companyId: c.CompanyId, companyName: c.CompanyName })),
  }));
}

async function createGroup({ groupName, scopeType, companyIds }) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('groupName', sql.NVarChar(200), groupName)
    .input('scopeType', sql.NVarChar(20), scopeType)
    .query(`
      INSERT INTO dbo.ReportAccessGroups (GroupName, ScopeType, CreatedDate)
      OUTPUT INSERTED.Id
      VALUES (@groupName, @scopeType, GETDATE())
    `);
  const groupId = result.recordset[0].Id;
  await setGroupCompanies(groupId, scopeType === 'SPECIFIC' ? companyIds : []);
  return groupId;
}

async function updateGroup(groupId, { groupName, scopeType, companyIds }) {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, groupId)
    .input('groupName', sql.NVarChar(200), groupName)
    .input('scopeType', sql.NVarChar(20), scopeType)
    .query(`
      UPDATE dbo.ReportAccessGroups SET GroupName = @groupName, ScopeType = @scopeType, UpdatedDate = GETDATE()
      WHERE Id = @id
    `);
  await setGroupCompanies(groupId, scopeType === 'SPECIFIC' ? companyIds : []);
}

async function setGroupCompanies(groupId, companyIds) {
  const pool = await getPool();
  await pool.request().input('groupId', sql.Int, groupId).query('DELETE FROM dbo.ReportAccessGroupCompanies WHERE GroupId = @groupId');
  for (const companyId of companyIds || []) {
    await pool
      .request()
      .input('groupId', sql.Int, groupId)
      .input('companyId', sql.Int, companyId)
      .query('INSERT INTO dbo.ReportAccessGroupCompanies (GroupId, CompanyId) VALUES (@groupId, @companyId)');
  }
}

/** Danh sach toan bo tai khoan kem nhom quyen dang gan (neu co) - phuc vu man hinh "Tai khoan". */
async function listUserAccess() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT u.UserID AS userId, u.Username AS username, u.FullName AS fullName,
           a.GroupId AS groupId, g.GroupName AS groupName, g.ScopeType AS scopeType
    FROM dbo.Users u
    LEFT JOIN dbo.UserReportAccess a ON a.UserId = u.UserID
    LEFT JOIN dbo.ReportAccessGroups g ON g.Id = a.GroupId
    ORDER BY u.Username
  `);
  return result.recordset;
}

/** groupId = null -> go khoi nhom quyen (ve mac dinh: chi xem cong ty/dia diem cua chinh minh). */
async function setUserGroup(userId, groupId, updatedBy) {
  const pool = await getPool();
  await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('groupId', sql.Int, groupId || null)
    .input('updatedBy', sql.NVarChar(100), updatedBy || null)
    .query(`
      MERGE dbo.UserReportAccess AS target
      USING (SELECT @userId AS UserId) AS src
      ON target.UserId = src.UserId
      WHEN MATCHED THEN UPDATE SET GroupId = @groupId, UpdatedBy = @updatedBy, UpdatedDate = GETDATE()
      WHEN NOT MATCHED THEN INSERT (UserId, GroupId, UpdatedBy, UpdatedDate)
        VALUES (@userId, @groupId, @updatedBy, GETDATE());
    `);
}

module.exports = {
  resolveVisibleLocationCodes,
  listGroups,
  createGroup,
  updateGroup,
  listUserAccess,
  setUserGroup,
};
