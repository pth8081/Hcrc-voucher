const { sql, getPool } = require('../config/db');
const companyService = require('./companyService');

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
      SELECT g.Id AS groupId, g.ScopeType AS scopeType, g.CreatedByPartnerConnectionId AS createdByPartnerConnectionId
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
    // Tai khoan chua duoc gan dia diem (LocationsDetail rong) VA khong o trong nhom quyen nao:
    // se luon thay bao cao trong, khong the phan biet voi "hom nay khong co giao dich" tren giao
    // dien - danh dau ro de controller/frontend bao dung nguyen nhan thay vi de trong lang.
    return { scope: 'own', codes: ownCode ? [ownCode] : [], unassigned: !ownCode };
  }

  // M20 (v3.81, QUAN TRONG - bao mat): nhom quyen CO CHU (CreatedByPartnerConnectionId khac
  // NULL, tao qua man hinh "Quan tri doi tac" - xem partnerAdminService.js) thi ScopeType='ALL'
  // KHONG DUOC hieu nhu ALL cua HCRC (bo qua loc hoan toan, tra ve { scope: 'all' }) - lam vay se
  // lo du lieu VOUCHER_SYNC cua HCRC va MOI doi tac khac cho 1 nhan vien chi dang lam cho 1 doi
  // tac. Phai tinh lai thanh danh sach dia diem cua DUNG cac cong ty THUOC VE doi tac do (dung
  // companyService.listByConnection - CUNG dieu kien "chu so huu" ma man "Quan tri doi tac" dang
  // dung de gioi han doi tac tu tao/xem cong ty cua chinh ho).
  if (group.scopeType === 'ALL') {
    if (group.createdByPartnerConnectionId) {
      const ownCompanies = await companyService.listByConnection(group.createdByPartnerConnectionId);
      const codesFromCompanies = await getLocationCodesForCompanies(ownCompanies.map((c) => c.Id));
      const codes = Array.from(new Set([ownCode, ...codesFromCompanies].filter(Boolean)));
      return { scope: 'specific', codes };
    }
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
      SELECT Id, GroupName, ScopeType, CreatedDate, UpdatedDate, CreatedByPartnerConnectionId
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

/** Danh sach nhom quyen do DUNG 1 doi tac (connectionId) tu tao - dung cho man hinh "Quan tri
 * doi tac" (xem partnerAdminService.js), giong het mau companyService.js#listByConnection. */
async function listGroupsByConnection(connectionId) {
  const pool = await getPool();
  const groups = (
    await pool
      .request()
      .input('connectionId', sql.Int, connectionId)
      .query(`
        SELECT Id, GroupName, ScopeType, CreatedDate, UpdatedDate
        FROM dbo.ReportAccessGroups
        WHERE CreatedByPartnerConnectionId = @connectionId
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

/** true neu nhom quyen (id) nay THUOC DUNG doi tac (connectionId) - dung de chan doi tac
 * sua/xoa/gan 1 nhom quyen KHONG phai cua ho (vd nhom quyen HCRC tao, hoac cua doi tac khac) -
 * xem partnerAdminService.js#assertReportAccessGroupOwnedByConnection. */
async function isGroupOwnedByConnection(groupId, connectionId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, groupId)
    .input('connectionId', sql.Int, connectionId)
    .query('SELECT 1 FROM dbo.ReportAccessGroups WHERE Id = @id AND CreatedByPartnerConnectionId = @connectionId');
  return !!result.recordset.length;
}

/** 1 nhom quyen theo id (kem danh sach companyIds) - dung de lay trang thai TRUOC KHI sua
 * (audit log ghi ca before/after, xem auditLogService.js). */
async function getGroupById(groupId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, groupId)
    .query('SELECT Id, GroupName, ScopeType, CreatedByPartnerConnectionId FROM dbo.ReportAccessGroups WHERE Id = @id');
  const row = result.recordset[0];
  if (!row) return null;
  const companyIds = await getGroupCompanyIds(row.Id);
  return { id: row.Id, groupName: row.GroupName, scopeType: row.ScopeType, createdByPartnerConnectionId: row.CreatedByPartnerConnectionId, companyIds };
}

async function createGroup({ groupName, scopeType, companyIds, createdByPartnerConnectionId }) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('groupName', sql.NVarChar(200), groupName)
    .input('scopeType', sql.NVarChar(20), scopeType)
    // null (mac dinh) = tao qua man hinh quan tri day du (HCRC) - giu nguyen hanh vi cu. Co gia
    // tri = do CHINH doi tac nay tu tao qua man hinh "Quan tri doi tac" (xem
    // partnerAdminService.js#createOwnReportAccessGroup) - xem ghi chu bao mat o
    // resolveVisibleLocationCodes() ve y nghia rieng cua ScopeType='ALL' trong truong hop nay.
    .input('createdByPartnerConnectionId', sql.Int, createdByPartnerConnectionId || null)
    .query(`
      INSERT INTO dbo.ReportAccessGroups (GroupName, ScopeType, CreatedDate, CreatedByPartnerConnectionId)
      OUTPUT INSERTED.Id
      VALUES (@groupName, @scopeType, GETDATE(), @createdByPartnerConnectionId)
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

/** Xoa 1 nhom quyen xem bao cao - CHAN neu con tai khoan nao dang duoc gan vao nhom nay
 * (UserReportAccess.GroupId co FK toi bang nay, xem sql/011), tra ve loi 409 ro rang. Phai go
 * gan (doi ve "mac dinh") het tai khoan truoc khi xoa duoc nhom. Xoa truoc danh sach cong ty
 * "duoc xem them" cua nhom (ReportAccessGroupCompanies) - thuoc ve chinh nhom nay, khong phai
 * du lieu rieng can giu lai. */
async function removeGroup(groupId) {
  const pool = await getPool();

  const userCount = await pool
    .request()
    .input('id', sql.Int, groupId)
    .query('SELECT COUNT(*) AS cnt FROM dbo.UserReportAccess WHERE GroupId = @id');
  const count = userCount.recordset[0].cnt;
  if (count > 0) {
    const err = new Error('Nhom quyen dang duoc gan cho tai khoan, khong the xoa');
    err.statusCode = 409;
    err.publicMessage = `Nhóm quyền này đang được gán cho ${count} tài khoản - vui lòng gỡ gán (đổi về "mặc định") các tài khoản đó ở màn hình "Tài khoản" trước khi xóa nhóm quyền.`;
    throw err;
  }

  await pool.request().input('id', sql.Int, groupId).query('DELETE FROM dbo.ReportAccessGroupCompanies WHERE GroupId = @id');
  await pool.request().input('id', sql.Int, groupId).query('DELETE FROM dbo.ReportAccessGroups WHERE Id = @id');
}

module.exports = {
  resolveVisibleLocationCodes,
  listGroups,
  listGroupsByConnection,
  isGroupOwnedByConnection,
  createGroup,
  updateGroup,
  removeGroup,
  getGroupById,
  getUserGroup,
  listUserAccess,
  setUserGroup,
};
