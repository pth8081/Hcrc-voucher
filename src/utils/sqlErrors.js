// Dot ra soat sau phat hien: cac cot co rang buoc UNIQUE (vd CompanyCode, PartnerCode) truoc day
// KHONG duoc kiem tra truoc o tang ung dung - neu admin luu 1 gia tri trung voi ban ghi KHAC,
// SQL Server tu choi voi loi driver tho (error 2627/2601), khong co statusCode/publicMessage nen
// roi thang vao nhanh 500 chung chung cua errorHandler.js ("Da xay ra loi he thong") thay vi 1
// thong bao ro rang nguoi dung hieu duoc va sua duoc ngay.
const UNIQUE_VIOLATION_NUMBERS = new Set([2627, 2601]);

/** Goi 1 ham async thuc hien cau lenh SQL (INSERT/UPDATE) - neu loi la vi pham rang buoc UNIQUE,
 * nem lai 1 loi 409 voi thong bao ro rang (neu ngoai) chi ten truong bi trung); loi khac giu
 * nguyen, khong can thiep. */
async function runWithUniqueConstraintMessage(fn, fieldLabel) {
  try {
    return await fn();
  } catch (err) {
    if (UNIQUE_VIOLATION_NUMBERS.has(err.number)) {
      const friendly = new Error(`${fieldLabel} da duoc su dung boi 1 ban ghi khac`);
      friendly.statusCode = 409;
      friendly.publicMessage = `${fieldLabel} nay da duoc su dung boi 1 ban ghi khac, vui long chon gia tri khac.`;
      throw friendly;
    }
    throw err;
  }
}

module.exports = { runWithUniqueConstraintMessage };
