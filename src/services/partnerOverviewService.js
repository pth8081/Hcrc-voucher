const apiConnectionService = require('./apiConnectionService');
const companyService = require('./companyService');
const redemptionUnitService = require('./redemptionUnitService');
const partnerAdminService = require('./partnerAdminService');

/**
 * Tong quan TOAN BO doi tac (ApiConnections) cho man hinh "Quan ly doi tac" (chi Quan tri HCRC,
 * xem partnerOverview.routes.js) - voi MOI doi tac dang co, liet ke Cong ty -> Diem tieu va Tai
 * khoan do CHINH doi tac do tao (dung lai dinh nghia "thuoc ve" CHINH XAC nhu man hinh "Quan tri
 * doi tac" cua ho - xem companyService.js#listByConnection, redemptionUnitService.js#listByConnection,
 * partnerAdminService.js#listScopedUsers - khong dinh nghia lai o day de tranh lech logic).
 *
 * Man hinh nay CHI DOC (khong sua/xoa gi) - cac thao tac quan tri that (khoa tai khoan, sua cong
 * ty/diem tieu...) van thuc hien o dung cac man hinh co san (Tai khoan, Don vi thu hoi).
 */
async function listOverview() {
  const connections = await apiConnectionService.list();

  return Promise.all(
    connections.map(async (conn) => {
      const [companies, units, accounts] = await Promise.all([
        companyService.listByConnection(conn.id),
        redemptionUnitService.listByConnection(conn.id),
        partnerAdminService.listScopedUsers(conn.id),
      ]);

      const unitsByCompany = new Map();
      units.forEach((u) => {
        if (!unitsByCompany.has(u.CompanyId)) unitsByCompany.set(u.CompanyId, []);
        unitsByCompany.get(u.CompanyId).push({
          unitId: u.Id,
          partnerCode: u.PartnerCode,
          partnerName: u.PartnerName,
          locationName: u.LocationName,
          status: !!u.Status,
        });
      });

      return {
        connectionId: conn.id,
        name: conn.name,
        isActive: conn.isActive,
        isLocked: conn.isLocked,
        companyCount: companies.length,
        unitCount: units.length,
        accountCount: accounts.length,
        companies: companies.map((c) => ({
          companyId: c.Id,
          companyCode: c.CompanyCode,
          companyName: c.CompanyName,
          status: !!c.Status,
          units: unitsByCompany.get(c.Id) || [],
        })),
        accounts: accounts.map((a) => ({
          userId: a.userId,
          username: a.username,
          fullName: a.fullName,
          state: a.state,
          isDeleted: a.isDeleted,
          isPartnerAdmin: !!a.permissions?.isPartnerAdmin,
        })),
      };
    })
  );
}

module.exports = { listOverview };
