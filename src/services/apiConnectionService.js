const crypto = require('crypto');
const { sql, getPool } = require('../config/db');
const { encrypt, decrypt } = require('../utils/crypto');

/**
 * Chung chi CA la du lieu CONG KHAI (dung de app XAC MINH server doi tac, khong phai de app
 * "chung minh danh tinh" voi doi tac - khac han private key) nen an toan khi admin dan/tai len
 * qua web. Van kiem tra chat de tranh 2 loi pho bien: (1) dan nham private key vao day (hieu lam
 * "cap key" giua 2 huong - da tung xay ra that trong du an nay, xem lich su PR #42/#43); (2) dan
 * noi dung khong phai PEM hop le, se khien http.Agent({ca}) nem loi KHO HIEU luc goi API that su
 * thay vi bao loi RO RANG ngay luc luu.
 */
function validateCustomCaCert(pem) {
  if (!pem) return null; // tuy chon - de trong la hop le (khong dung CA rieng)
  const trimmed = String(pem).trim();
  if (/-----BEGIN (RSA |EC |ENCRYPTED )?PRIVATE KEY-----/.test(trimmed)) {
    return 'Noi dung ban dan la PRIVATE KEY, khong phai chung chi CA cong khai. O day CHI can file chung chi (.crt/.pem) do doi tac cung cap de app tin tuong may chu cua ho - KHONG dan private key (du la cua ai) vao day.';
  }
  const blocks = trimmed.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
  if (!blocks || !blocks.length) {
    return 'Khong doc duoc noi dung chung chi CA. Can dung dinh dang PEM, bat dau bang dong "-----BEGIN CERTIFICATE-----" va ket thuc bang "-----END CERTIFICATE-----".';
  }
  for (const block of blocks) {
    try {
      // eslint-disable-next-line no-new
      new crypto.X509Certificate(block);
    } catch (err) {
      return `Mot trong cac chung chi dan vao khong hop le (loi doc: ${err.message}). Kiem tra lai noi dung file doi tac gui.`;
    }
  }
  return null; // hop le
}

const KEEP_SECRET = '__KEEP__'; // gia tri dac biet FE gui len khi khong doi secret da luu

// Tu dot ra soat sau merge PR #31: khoa sp_getapplock luc thu hoi (voucherService.js) gio giu 1
// ket noi/transaction trong pool DB XUYEN SUOT thoi gian cho Core phan hoi (H5). Neu admin cau
// hinh 1 timeoutMs qua lon, 1 Core cham/treo co the giu 1 ket noi pool rat lau, de can kiet pool
// khi co nhieu luot thu hoi dong thoi. Chan tran o day de LockTimeout (15000ms, voucherService.js)
// luon lon hon timeoutMs thuc te cua BAT KY connection nao, va gioi han ro thoi gian toi da 1 ket
// noi pool co the bi giu boi 1 lan goi Core.
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 10000;
function clampTimeoutMs(raw) {
  const n = Number(raw) || 8000;
  return Math.min(Math.max(n, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
}

const DEFAULT_CHECK_MAPPING = {
  foundPath: 'found',
  statusPath: 'status',
  serialPath: 'serial',
  valueAmtPath: 'valueAmt',
  issueDatePath: 'issueDate',
  expiryDatePath: 'expiryDate',
  messagePath: 'message',
  statusValueMap: { UNUSED: 'UNUSED', USED: 'USED', EXPIRED: 'EXPIRED', CANCELLED: 'CANCELLED' },
};

const DEFAULT_REDEEM_MAPPING = {
  successPath: 'success',
  statusPath: 'status',
  transRefPath: 'transRef',
  redeemedAtPath: 'redeemedAt',
  messagePath: 'message',
  statusValueMap: { REDEEMED: 'REDEEMED', USED: 'USED' },
};

/**
 * Dot ra soat sau phat hien: gia tri "mac dinh" khi tao ket noi MOI truoc day chi la 1 mau
 * TRUNG TINH, khong khop voi Core API that su dang dung (tai lieu doi tac cung cap: xac thuc
 * X-API-Key, path /api/v1/vouchers/check|redeem, phan hoi goi trong {"data": {...}} - xem
 * README muc 4a) - admin van phai tu tay dien lai toan bo moi lan tao ket noi. Doi thanh DUNG
 * cau hinh cua doi tac hien tai (deployment nay hien chi tich hop 1 Core API) de admin CHI can
 * dien 3 truong: Ten ket noi, Base URL, Gia tri API Key - moi truong con lai da dung san. KHONG
 * BAO GIO dat san gia tri API Key that o day (day la ma nguon, se bi lo neu commit) - chi dien
 * san TEN header, gia tri key van phai admin tu nhap tren form.
 */
function getDefaults() {
  return {
    authType: 'API_KEY_HEADER',
    apiKeyHeaderName: 'X-API-Key',

    checkMethod: 'POST',
    checkParamMode: 'BODY',
    checkParamName: 'voucherCode',
    checkPath: '/api/v1/vouchers/check',
    checkMapping: {
      statusPath: 'data.status',
      serialPath: 'data.voucherSerial',
      valueAmtPath: 'data.valueAmt',
      issueDatePath: 'data.issueDate',
      expiryDatePath: 'data.expiryDate',
      messagePath: 'data.message',
    },

    redeemMethod: 'POST',
    redeemParamMode: 'BODY',
    redeemParamName: 'voucherCode',
    redeemPath: '/api/v1/vouchers/redeem',
    redeemBodyTemplate: { voucherCode: '{code}' },
    redeemMapping: {
      successPath: 'data.success',
      statusPath: 'data.status',
      transRefPath: 'data.transNum',
      redeemedAtPath: 'data.redeemedAt',
      messagePath: 'data.message',
    },

    // Mac dinh KHONG co CA rieng - doi tac hien dung chung chi HTTPS cong khai thong thuong,
    // Node.js tu tin tuong san. Chi dien khi doi tac chuyen sang chung chi tu ky/CA noi bo.
    customCaCert: null,
  };
}

/**
 * Chuan hoa danh sach tien to (dung chung cho CA "bi loai tru" va "duoc chap nhan") tu form
 * (chuoi cach nhau boi dau phay, hoac mang san) ve 1 chuoi luu DB: trim tung phan tu, bo phan tu
 * rong, bo trung, GIU NGUYEN hoa/thuong (so khop sau nay la CHINH XAC tung ky tu, khong chuan hoa
 * ve 1 kieu chu).
 */
function normalizePrefixList(raw) {
  if (!raw) return null;
  const parts = Array.isArray(raw) ? raw : String(raw).split(',');
  const cleaned = Array.from(new Set(parts.map((p) => String(p).trim()).filter(Boolean)));
  return cleaned.length ? cleaned.join(', ') : null;
}

function parsePrefixList(stored) {
  if (!stored) return [];
  return String(stored)
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

const CODE_PREFIX_FILTER_MODES = ['EXCLUDE', 'INCLUDE'];

/** Khong hop le (hoac rong) -> mac dinh 'EXCLUDE' - giu nguyen hanh vi cu cho moi ket noi da co. */
function normalizeCodePrefixFilterMode(value) {
  return CODE_PREFIX_FILTER_MODES.includes(value) ? value : 'EXCLUDE';
}

/**
 * Chi khi dung che do INCLUDE (chap nhan/whitelist) moi can kiem tra: bat buoc phai co IT NHAT 1
 * tien to duoc chap nhan, tranh truong hop admin bam chon "Chi chap nhan" nhung de trong o nhap -
 * neu cho luu se khoa CHET 100% luot quet/thu hoi that cua ca ket noi (khong co tien to nao duoc
 * chap nhan = khong ma nao qua duoc), rat de xay ra ngoai y muon va kho phat hien ngay luc luu.
 */
function validateCodePrefixFilterConfig({ codePrefixFilterMode, allowedCodePrefixes }) {
  if (normalizeCodePrefixFilterMode(codePrefixFilterMode) !== 'INCLUDE') return null;
  if (!normalizePrefixList(allowedCodePrefixes)) {
    return 'Da chon che do "Chi chap nhan tien to" nhung chua nhap tien to nao duoc chap nhan - can nhap it nhat 1 tien to, neu khong TOAN BO ma voucher qua ket noi nay se bi tu choi.';
  }
  return null;
}

function toRow(data) {
  return {
    name: data.name,
    baseUrl: data.baseUrl,
    authType: data.authType || 'NONE',
    apiKeyHeaderName: data.apiKeyHeaderName || null,
    basicUsername: data.basicUsername || null,
    timeoutMs: clampTimeoutMs(data.timeoutMs),

    checkMethod: data.checkMethod || 'GET',
    checkPath: data.checkPath,
    checkParamMode: data.checkParamMode || 'PATH',
    checkParamName: data.checkParamName || null,
    checkBodyTemplate: data.checkBodyTemplate ? JSON.stringify(data.checkBodyTemplate) : null,
    checkMapping: JSON.stringify(data.checkMapping || DEFAULT_CHECK_MAPPING),

    redeemMethod: data.redeemMethod || 'POST',
    redeemPath: data.redeemPath,
    redeemParamMode: data.redeemParamMode || 'BODY',
    redeemParamName: data.redeemParamName || null,
    redeemBodyTemplate: data.redeemBodyTemplate ? JSON.stringify(data.redeemBodyTemplate) : null,
    redeemMapping: JSON.stringify(data.redeemMapping || DEFAULT_REDEEM_MAPPING),

    customCaCert: data.customCaCert ? String(data.customCaCert).trim() : null,
    excludedCodePrefixes: normalizePrefixList(data.excludedCodePrefixes),
    allowedCodePrefixes: normalizePrefixList(data.allowedCodePrefixes),
    codePrefixFilterMode: normalizeCodePrefixFilterMode(data.codePrefixFilterMode),
  };
}

function safeParse(json, fallback) {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch (err) {
    return fallback;
  }
}

function toMaskedDto(row) {
  return {
    id: row.Id,
    name: row.Name,
    isActive: !!row.IsActive,
    isLocked: !!row.IsLocked,
    baseUrl: row.BaseUrl,
    authType: row.AuthType,
    hasAuthToken: !!row.AuthTokenEncrypted,
    apiKeyHeaderName: row.ApiKeyHeaderName,
    basicUsername: row.BasicUsername,
    hasBasicPassword: !!row.BasicPasswordEncrypted,
    timeoutMs: row.TimeoutMs,

    checkMethod: row.CheckMethod,
    checkPath: row.CheckPath,
    checkParamMode: row.CheckParamMode,
    checkParamName: row.CheckParamName,
    checkBodyTemplate: safeParse(row.CheckBodyTemplate, null),
    checkMapping: safeParse(row.CheckMapping, DEFAULT_CHECK_MAPPING),

    redeemMethod: row.RedeemMethod,
    redeemPath: row.RedeemPath,
    redeemParamMode: row.RedeemParamMode,
    redeemParamName: row.RedeemParamName,
    redeemBodyTemplate: safeParse(row.RedeemBodyTemplate, null),
    redeemMapping: safeParse(row.RedeemMapping, DEFAULT_REDEEM_MAPPING),

    // Khong phai bi mat (khac AuthTokenEncrypted/BasicPasswordEncrypted o tren) - tra ve nguyen
    // van de admin xem/sua lai duoc, khong can co che "giu nguyen neu de trong" nhu 2 truong secret.
    customCaCert: row.CustomCaCert || null,
    excludedCodePrefixes: parsePrefixList(row.ExcludedCodePrefixes),
    allowedCodePrefixes: parsePrefixList(row.AllowedCodePrefixes),
    codePrefixFilterMode: normalizeCodePrefixFilterMode(row.CodePrefixFilterMode),

    createdDate: row.CreatedDate,
    updatedDate: row.UpdatedDate,
    updatedBy: row.UpdatedBy,
  };
}

function toDecryptedConfig(row) {
  return {
    ...toMaskedDto(row),
    authToken: decrypt(row.AuthTokenEncrypted),
    basicPassword: decrypt(row.BasicPasswordEncrypted),
  };
}

async function list() {
  const pool = await getPool();
  const result = await pool.request().query('SELECT * FROM dbo.ApiConnections ORDER BY IsActive DESC, Name');
  return result.recordset.map(toMaskedDto);
}

async function getById(id) {
  const pool = await getPool();
  const result = await pool.request().input('id', sql.Int, id).query('SELECT * FROM dbo.ApiConnections WHERE Id = @id');
  return result.recordset[0] ? toMaskedDto(result.recordset[0]) : null;
}

const PREFIX_FILTER_COLUMNS = 'Id, Name, IsActive, IsLocked, ExcludedCodePrefixes, AllowedCodePrefixes, CodePrefixFilterMode';

function toPrefixFilterDto(row) {
  return {
    id: row.Id,
    name: row.Name,
    isActive: !!row.IsActive,
    isLocked: !!row.IsLocked,
    codePrefixFilterMode: normalizeCodePrefixFilterMode(row.CodePrefixFilterMode),
    excludedCodePrefixes: parsePrefixList(row.ExcludedCodePrefixes),
    allowedCodePrefixes: parsePrefixList(row.AllowedCodePrefixes),
  };
}

/**
 * Danh sach RUT GON CHI gom ten + cau hinh loc tien to (khong Base URL/xac thuc/mapping...) - dung
 * cho man hinh "Loc ma voucher" (voucherCodeFilter.controller.js), tach rieng khoi list() day du
 * (chi admin co adminCanManageConnections moi vao duoc) de 1 tai khoan CHI duoc cap quyen loc
 * tien to (sql/049) khong thay/khong sua duoc cau hinh ket noi khac, du khong phai la du lieu bi
 * mat (list()/toMaskedDto da an secret tu truoc) - day la gioi han PHAM VI theo dung thiet ke.
 */
async function listPrefixFilterOnly() {
  const pool = await getPool();
  const result = await pool.request().query(`SELECT ${PREFIX_FILTER_COLUMNS} FROM dbo.ApiConnections ORDER BY IsActive DESC, Name`);
  return result.recordset.map(toPrefixFilterDto);
}

async function getPrefixFilterOnly(id) {
  const pool = await getPool();
  const result = await pool.request().input('id', sql.Int, id).query(`SELECT ${PREFIX_FILTER_COLUMNS} FROM dbo.ApiConnections WHERE Id = @id`);
  return result.recordset[0] ? toPrefixFilterDto(result.recordset[0]) : null;
}

/**
 * UPDATE CHI 3 cot loc tien to - KHONG dung chung voi update() day du (toRow()/validateBody doi
 * hoi name/baseUrl/checkPath/redeemPath, se luon that bai voi payload RUT GON cua man hinh nay).
 * Goi tu voucherCodeFilter.controller.js, sau khi da qua validateCodePrefixFilterConfig().
 */
async function updatePrefixFilterOnly(id, data, updatedBy) {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('codePrefixFilterMode', sql.NVarChar(10), normalizeCodePrefixFilterMode(data.codePrefixFilterMode))
    .input('excludedCodePrefixes', sql.NVarChar(500), normalizePrefixList(data.excludedCodePrefixes))
    .input('allowedCodePrefixes', sql.NVarChar(500), normalizePrefixList(data.allowedCodePrefixes))
    .input('updatedBy', sql.NVarChar(100), updatedBy || null)
    .query(`
      UPDATE dbo.ApiConnections SET
        CodePrefixFilterMode = @codePrefixFilterMode, ExcludedCodePrefixes = @excludedCodePrefixes,
        AllowedCodePrefixes = @allowedCodePrefixes, UpdatedDate = GETDATE(), UpdatedBy = @updatedBy
      WHERE Id = @id
    `);
}

async function getByIdDecrypted(id) {
  const pool = await getPool();
  const result = await pool.request().input('id', sql.Int, id).query('SELECT * FROM dbo.ApiConnections WHERE Id = @id');
  return result.recordset[0] ? toDecryptedConfig(result.recordset[0]) : null;
}

/**
 * Danh sach RUT GON (id, name, isActive) - dung cho o chon "He thong voucher" tren man hinh
 * Quet voucher (MOI tai khoan co quyen thu hoi deu goi duoc, khong chi admin). KHONG tra ve
 * baseUrl/path/mapping/secret nhu list() (danh cho man hinh quan tri "Ket noi API", chi admin) -
 * nhan vien thu hoi chi can biet TEN de chon, khong can/khong nen thay chi tiet cau hinh ket noi.
 *
 * CHI tra ve ket noi da "SAN SANG" (co du secret can thiet theo AuthType) - loai bo ket noi
 * con la BAN NHAP (vd tao san cho 1 he thong moi nhung chua dien API Key that, xem
 * sql/029_seed_fuji_connection.sql). Tranh truong hop nhan vien thay o chon "He thong voucher"
 * xuat hien (va co the bam nham) truoc khi admin dien xong cau hinh that - KHONG lien quan gi
 * den IsActive (1 ket noi KHONG active van phai hien ra o day neu da san sang, vi IsActive chi
 * quyet dinh lua chon MAC DINH, khong phai co hien ra hay khong - xem README muc 4e).
 *
 * Cung loai bo ket noi dang bi KHOA (IsLocked = 1, man hinh "Ket noi API") - admin khoa 1 ket
 * noi nghia la tam vo hieu hoa hoan toan, nhan vien khong duoc thay/chon no o day nua.
 */
async function listOptions() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT Id, Name, IsActive FROM dbo.ApiConnections
    WHERE IsLocked = 0
      AND (
        AuthType = 'NONE'
        OR (AuthType IN ('BEARER', 'API_KEY_HEADER') AND AuthTokenEncrypted IS NOT NULL)
        OR (AuthType = 'BASIC' AND BasicPasswordEncrypted IS NOT NULL)
      )
    ORDER BY IsActive DESC, Name
  `);
  return result.recordset.map((r) => ({ id: r.Id, name: r.Name, isActive: !!r.IsActive }));
}

/**
 * Cau hinh loc tien to ma voucher cua 1 ket noi CU THE (connectionId), hoac cua ket noi dang
 * ACTIVE neu khong truyen connectionId - dung CHUNG 1 quy tac "khong truyen = dung ket noi active"
 * voi coreVoucherService.js#resolveConnection, de dam bao cau hinh loc dung VOI DUNG he thong
 * voucherService.js sap goi, khong bi lech. Chi doc Name + 2 cot loc (khong can giai ma secret),
 * dung o buoc chan SOM truoc khi goi Core API that su - xem voucherService.js.
 */
async function getPrefixFilterConfig(connectionId) {
  const pool = await getPool();
  const request = pool.request();
  let query;
  if (connectionId) {
    request.input('id', sql.Int, connectionId);
    query = 'SELECT Name, ExcludedCodePrefixes, AllowedCodePrefixes, CodePrefixFilterMode FROM dbo.ApiConnections WHERE Id = @id';
  } else {
    query = 'SELECT TOP 1 Name, ExcludedCodePrefixes, AllowedCodePrefixes, CodePrefixFilterMode FROM dbo.ApiConnections WHERE IsActive = 1';
  }
  const result = await request.query(query);
  const row = result.recordset[0];
  if (!row) return { connectionName: null, codePrefixFilterMode: 'EXCLUDE', excludedCodePrefixes: [], allowedCodePrefixes: [] };
  return {
    connectionName: row.Name,
    codePrefixFilterMode: normalizeCodePrefixFilterMode(row.CodePrefixFilterMode),
    excludedCodePrefixes: parsePrefixList(row.ExcludedCodePrefixes),
    allowedCodePrefixes: parsePrefixList(row.AllowedCodePrefixes),
  };
}

/**
 * Logic THUAN (khong doc DB) doi chieu 1 ma voucher voi cau hinh loc tien to - nhan vao CUNG 1
 * hinh dang du lieu (codePrefixFilterMode/excludedCodePrefixes/allowedCodePrefixes) voi ca ket
 * noi da luu (qua getPrefixFilterConfig() hoac toMaskedDto()) VA ban nhap dang test tren form
 * chua luu (apiConnection.controller.js#testRedeem dung truc tiep DTO connection, khong can query
 * DB rieng). Tra ve null neu ma duoc quet/thu hoi binh thuong, hoac { mode, matchedPrefix?,
 * allowedPrefixes? } neu bi chan.
 *
 * Che do INCLUDE nhung allowedCodePrefixes dang RONG: coi nhu CHUA cau hinh gi (khong chan) thay
 * vi chan het - an toan hon (validateCodePrefixFilterConfig da chan truong hop nay o luc LUU, day
 * chi la lop phong ve thu 2 cho du lieu cu/ban nhap chua qua buoc kiem tra do).
 */
function matchPrefixFilter({ codePrefixFilterMode, excludedCodePrefixes = [], allowedCodePrefixes = [] }, voucherCode) {
  if (normalizeCodePrefixFilterMode(codePrefixFilterMode) === 'INCLUDE') {
    if (!allowedCodePrefixes.length) return null;
    const matched = allowedCodePrefixes.some((p) => voucherCode.startsWith(p));
    return matched ? null : { mode: 'INCLUDE', allowedPrefixes: allowedCodePrefixes };
  }
  const matchedPrefix = excludedCodePrefixes.find((p) => voucherCode.startsWith(p));
  return matchedPrefix ? { mode: 'EXCLUDE', matchedPrefix } : null;
}

async function getActiveDecrypted() {
  const pool = await getPool();
  const result = await pool.request().query('SELECT TOP 1 * FROM dbo.ApiConnections WHERE IsActive = 1');
  return result.recordset[0] ? toDecryptedConfig(result.recordset[0]) : null;
}

async function create(data) {
  const pool = await getPool();
  const row = toRow(data);
  const result = await pool
    .request()
    .input('name', sql.NVarChar(100), row.name)
    .input('baseUrl', sql.NVarChar(500), row.baseUrl)
    .input('authType', sql.NVarChar(20), row.authType)
    .input('authTokenEncrypted', sql.NVarChar(1000), encrypt(data.authToken))
    .input('apiKeyHeaderName', sql.NVarChar(100), row.apiKeyHeaderName)
    .input('basicUsername', sql.NVarChar(200), row.basicUsername)
    .input('basicPasswordEncrypted', sql.NVarChar(1000), encrypt(data.basicPassword))
    .input('timeoutMs', sql.Int, row.timeoutMs)
    .input('checkMethod', sql.NVarChar(10), row.checkMethod)
    .input('checkPath', sql.NVarChar(500), row.checkPath)
    .input('checkParamMode', sql.NVarChar(10), row.checkParamMode)
    .input('checkParamName', sql.NVarChar(100), row.checkParamName)
    .input('checkBodyTemplate', sql.NVarChar(sql.MAX), row.checkBodyTemplate)
    .input('checkMapping', sql.NVarChar(sql.MAX), row.checkMapping)
    .input('redeemMethod', sql.NVarChar(10), row.redeemMethod)
    .input('redeemPath', sql.NVarChar(500), row.redeemPath)
    .input('redeemParamMode', sql.NVarChar(10), row.redeemParamMode)
    .input('redeemParamName', sql.NVarChar(100), row.redeemParamName)
    .input('redeemBodyTemplate', sql.NVarChar(sql.MAX), row.redeemBodyTemplate)
    .input('redeemMapping', sql.NVarChar(sql.MAX), row.redeemMapping)
    .input('customCaCert', sql.NVarChar(sql.MAX), row.customCaCert)
    .input('excludedCodePrefixes', sql.NVarChar(500), row.excludedCodePrefixes)
    .input('allowedCodePrefixes', sql.NVarChar(500), row.allowedCodePrefixes)
    .input('codePrefixFilterMode', sql.NVarChar(10), row.codePrefixFilterMode)
    .input('updatedBy', sql.NVarChar(100), data.updatedBy || null)
    .query(`
      INSERT INTO dbo.ApiConnections
        (Name, IsActive, BaseUrl, AuthType, AuthTokenEncrypted, ApiKeyHeaderName, BasicUsername,
         BasicPasswordEncrypted, TimeoutMs, CheckMethod, CheckPath, CheckParamMode, CheckParamName,
         CheckBodyTemplate, CheckMapping, RedeemMethod, RedeemPath, RedeemParamMode, RedeemParamName,
         RedeemBodyTemplate, RedeemMapping, CustomCaCert, ExcludedCodePrefixes, AllowedCodePrefixes,
         CodePrefixFilterMode, CreatedDate, UpdatedBy)
      OUTPUT INSERTED.Id
      VALUES
        (@name, 0, @baseUrl, @authType, @authTokenEncrypted, @apiKeyHeaderName, @basicUsername,
         @basicPasswordEncrypted, @timeoutMs, @checkMethod, @checkPath, @checkParamMode, @checkParamName,
         @checkBodyTemplate, @checkMapping, @redeemMethod, @redeemPath, @redeemParamMode, @redeemParamName,
         @redeemBodyTemplate, @redeemMapping, @customCaCert, @excludedCodePrefixes, @allowedCodePrefixes,
         @codePrefixFilterMode, GETDATE(), @updatedBy)
    `);
  return result.recordset[0].Id;
}

async function update(id, data) {
  const pool = await getPool();
  const row = toRow(data);
  const request = pool
    .request()
    .input('id', sql.Int, id)
    .input('name', sql.NVarChar(100), row.name)
    .input('baseUrl', sql.NVarChar(500), row.baseUrl)
    .input('authType', sql.NVarChar(20), row.authType)
    .input('apiKeyHeaderName', sql.NVarChar(100), row.apiKeyHeaderName)
    .input('basicUsername', sql.NVarChar(200), row.basicUsername)
    .input('timeoutMs', sql.Int, row.timeoutMs)
    .input('checkMethod', sql.NVarChar(10), row.checkMethod)
    .input('checkPath', sql.NVarChar(500), row.checkPath)
    .input('checkParamMode', sql.NVarChar(10), row.checkParamMode)
    .input('checkParamName', sql.NVarChar(100), row.checkParamName)
    .input('checkBodyTemplate', sql.NVarChar(sql.MAX), row.checkBodyTemplate)
    .input('checkMapping', sql.NVarChar(sql.MAX), row.checkMapping)
    .input('redeemMethod', sql.NVarChar(10), row.redeemMethod)
    .input('redeemPath', sql.NVarChar(500), row.redeemPath)
    .input('redeemParamMode', sql.NVarChar(10), row.redeemParamMode)
    .input('redeemParamName', sql.NVarChar(100), row.redeemParamName)
    .input('redeemBodyTemplate', sql.NVarChar(sql.MAX), row.redeemBodyTemplate)
    .input('redeemMapping', sql.NVarChar(sql.MAX), row.redeemMapping)
    .input('customCaCert', sql.NVarChar(sql.MAX), row.customCaCert)
    .input('excludedCodePrefixes', sql.NVarChar(500), row.excludedCodePrefixes)
    .input('allowedCodePrefixes', sql.NVarChar(500), row.allowedCodePrefixes)
    .input('codePrefixFilterMode', sql.NVarChar(10), row.codePrefixFilterMode)
    .input('updatedBy', sql.NVarChar(100), data.updatedBy || null);

  // L8 (loi that da xay ra): form Sua tren FE luon gui authToken/basicPassword la CHUOI RONG
  // khi admin de trong o do (dung y muon GIU NGUYEN secret da luu - placeholder "Da luu - de
  // trong de giu nguyen"), KHONG GUI hang so KEEP_SECRET nhu thiet ke ban dau mong doi. Dieu
  // kien cu chi loai tru `undefined`/KEEP_SECRET nen van coi chuoi rong la "doi sang secret
  // moi" -> encrypt('') tra ve NULL (xem utils/crypto.js) -> XOA MAT secret dang hoat dong chi
  // vi admin sua 1 truong khac (vd doi Ten) ma khong go lai Key - khien ket noi do bien mat khoi
  // o chon he thong tren man Quet voucher (apiConnectionService.js#listOptions chi liet ke ket
  // noi co secret KHAC NULL). Sua dung ca falsy (chuoi rong) GIONG het KEEP_SECRET: chi ghi de
  // secret khi admin THAT SU go gia tri moi vao o do.
  let secretSet = '';
  if (data.authToken && data.authToken !== KEEP_SECRET) {
    request.input('authTokenEncrypted', sql.NVarChar(1000), encrypt(data.authToken));
    secretSet += ', AuthTokenEncrypted = @authTokenEncrypted';
  }
  if (data.basicPassword && data.basicPassword !== KEEP_SECRET) {
    request.input('basicPasswordEncrypted', sql.NVarChar(1000), encrypt(data.basicPassword));
    secretSet += ', BasicPasswordEncrypted = @basicPasswordEncrypted';
  }

  await request.query(`
    UPDATE dbo.ApiConnections SET
      Name = @name, BaseUrl = @baseUrl, AuthType = @authType,
      ApiKeyHeaderName = @apiKeyHeaderName, BasicUsername = @basicUsername,
      TimeoutMs = @timeoutMs,
      CheckMethod = @checkMethod, CheckPath = @checkPath, CheckParamMode = @checkParamMode,
      CheckParamName = @checkParamName, CheckBodyTemplate = @checkBodyTemplate, CheckMapping = @checkMapping,
      RedeemMethod = @redeemMethod, RedeemPath = @redeemPath, RedeemParamMode = @redeemParamMode,
      RedeemParamName = @redeemParamName, RedeemBodyTemplate = @redeemBodyTemplate, RedeemMapping = @redeemMapping,
      CustomCaCert = @customCaCert, ExcludedCodePrefixes = @excludedCodePrefixes,
      AllowedCodePrefixes = @allowedCodePrefixes, CodePrefixFilterMode = @codePrefixFilterMode,
      UpdatedDate = GETDATE(), UpdatedBy = @updatedBy
      ${secretSet}
    WHERE Id = @id
  `);
}

async function activate(id) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  let rolledBack = false;
  try {
    // Khong cho kich hoat 1 ket noi dang bi KHOA - tranh truong hop admin vo tinh dat lam ket
    // noi mac dinh 1 he thong minh vua chu dong vo hieu hoa (phai mo khoa truoc).
    const target = await transaction
      .request()
      .input('id', sql.Int, id)
      .query('SELECT IsLocked FROM dbo.ApiConnections WITH (UPDLOCK, HOLDLOCK) WHERE Id = @id');
    if (!target.recordset.length) {
      rolledBack = true;
      await transaction.rollback();
      const err = new Error('Khong tim thay ket noi de kich hoat');
      err.statusCode = 404;
      err.publicMessage = 'Khong tim thay ket noi nay (co the da bi xoa), vui long tai lai trang.';
      throw err;
    }
    if (target.recordset[0].IsLocked) {
      rolledBack = true;
      await transaction.rollback();
      const err = new Error('Ket noi dang bi khoa');
      err.statusCode = 400;
      err.publicMessage = 'Ket noi nay dang bi khoa - vui long mo khoa truoc khi kich hoat.';
      throw err;
    }

    await transaction.request().query('UPDATE dbo.ApiConnections SET IsActive = 0');
    const result = await transaction
      .request()
      .input('id', sql.Int, id)
      .query('UPDATE dbo.ApiConnections SET IsActive = 1 WHERE Id = @id');
    // Dot ra soat sau phat hien: truoc day khong kiem tra id co ton tai khong - goi voi 1 id
    // rac (da xoa/khong ton tai) van "thanh cong", nhung buoc tat active o tren van chay truoc
    // do -> KHONG CON ket noi nao active, sap toan bo luong kiem tra/thu hoi voucher ma khong
    // co canh bao (giong het hau qua cua M5, chi khac nguyen nhan). Rollback thay vi commit
    // neu id khong khop dong nao.
    if (result.rowsAffected[0] === 0) {
      rolledBack = true;
      await transaction.rollback();
      const err = new Error('Khong tim thay ket noi de kich hoat');
      err.statusCode = 404;
      err.publicMessage = 'Khong tim thay ket noi nay (co the da bi xoa), vui long tai lai trang.';
      throw err;
    }
    await transaction.commit();
  } catch (err) {
    if (!rolledBack) await transaction.rollback();
    throw err;
  }
}

/**
 * Khoa/mo khoa 1 ket noi (nut "Khoa"/"Mo khoa" tren man hinh "Ket noi API") - khoa nghia la
 * vo hieu hoa HOAN TOAN ket noi nay cho ca luong kiem tra/thu hoi voucher (coreVoucherService.js
 * #resolveConnection chan luc dung) VA an no khoi o chon "He thong voucher" (listOptions() o
 * tren), bat ke dang la ket noi active hay khong - khac remove() (xoa han, khong hoan tac duoc),
 * khoa la thao tac AN TOAN/TAM THOI, co the mo lai bat cu luc nao, khong mat du lieu cau hinh.
 */
async function setLocked(id, locked) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .input('isLocked', sql.Bit, locked ? 1 : 0)
    .query('UPDATE dbo.ApiConnections SET IsLocked = @isLocked WHERE Id = @id');
  if (result.rowsAffected[0] === 0) {
    const err = new Error('Khong tim thay ket noi');
    err.statusCode = 404;
    err.publicMessage = 'Khong tim thay ket noi nay (co the da bi xoa), vui long tai lai trang.';
    throw err;
  }
}

async function remove(id) {
  const pool = await getPool();
  // M5: truoc day xoa duoc ca ket noi DANG ACTIVE - xoa xong, apiConnectionService.getActiveDecrypted()
  // khong con tra ve gi (khong con dong nao IsActive=1), voucherService/coreVoucherService.js roi
  // ve nhanh fallback .env cu (co the CHUA cau hinh, hoac tro toi 1 Core KHAC) - sap toan bo
  // luong kiem tra/thu hoi voucher ngay lap tuc ma khong co canh bao truoc. Bat buoc phai
  // KICH HOAT 1 ket noi khac (hoac chu dong tat active) truoc khi xoa.
  //
  // Dot ra soat sau phat hien: buoc kiem tra IsActive va buoc DELETE truoc day la 2 cau lenh
  // RIENG BIET, khong nam trong transaction - 1 admin khac co the activate() dung ket noi nay
  // GIUA 2 buoc do, khien no bi xoa ngay sau khi vua thanh active. Gop vao 1 transaction, kiem
  // tra IsActive TRONG transaction (khoa hang, tranh doc du lieu cu trong luc admin khac dang
  // activate cung dong nay).
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const check = await transaction
      .request()
      .input('id', sql.Int, id)
      .query('SELECT IsActive FROM dbo.ApiConnections WITH (UPDLOCK, HOLDLOCK) WHERE Id = @id');
    if (check.recordset.length && check.recordset[0].IsActive) {
      const err = new Error('Khong the xoa ket noi dang duoc kich hoat (active)');
      err.statusCode = 400;
      err.publicMessage = 'Ket noi nay dang duoc su dung (active) cho luong kiem tra/thu hoi voucher. Vui long kich hoat 1 ket noi khac truoc khi xoa ket noi nay, de tranh lam gian doan nghiep vu.';
      throw err;
    }
    await transaction.request().input('id', sql.Int, id).query('DELETE FROM dbo.ApiConnections WHERE Id = @id');
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/** Ghep du lieu draft tu form (chua luu DB) thanh config da "giai ma" san, dung de test truoc khi luu. */
function resolveDraftConfig(data) {
  return {
    id: null,
    name: data.name || '(chua luu)',
    baseUrl: data.baseUrl,
    authType: data.authType || 'NONE',
    authToken: data.authToken || null,
    apiKeyHeaderName: data.apiKeyHeaderName || null,
    basicUsername: data.basicUsername || null,
    basicPassword: data.basicPassword || null,
    timeoutMs: clampTimeoutMs(data.timeoutMs),

    checkMethod: data.checkMethod || 'GET',
    checkPath: data.checkPath,
    checkParamMode: data.checkParamMode || 'PATH',
    checkParamName: data.checkParamName || null,
    checkBodyTemplate: data.checkBodyTemplate || null,
    checkMapping: data.checkMapping || DEFAULT_CHECK_MAPPING,

    redeemMethod: data.redeemMethod || 'POST',
    redeemPath: data.redeemPath,
    redeemParamMode: data.redeemParamMode || 'BODY',
    redeemParamName: data.redeemParamName || null,
    redeemBodyTemplate: data.redeemBodyTemplate || null,
    redeemMapping: data.redeemMapping || DEFAULT_REDEEM_MAPPING,

    customCaCert: data.customCaCert ? String(data.customCaCert).trim() : null,
    excludedCodePrefixes: parsePrefixList(data.excludedCodePrefixes),
    allowedCodePrefixes: parsePrefixList(data.allowedCodePrefixes),
    codePrefixFilterMode: normalizeCodePrefixFilterMode(data.codePrefixFilterMode),
  };
}

async function logTest({ connectionId, action, voucherCode, requestUrl, httpStatus, latencyMs, success, rawResponse, normalizedResult, errorMessage, testedBy }) {
  const pool = await getPool();
  await pool
    .request()
    .input('connectionId', sql.Int, connectionId || null)
    .input('action', sql.NVarChar(10), action)
    .input('voucherCode', sql.NVarChar(24), voucherCode)
    .input('requestUrl', sql.NVarChar(1000), requestUrl || null)
    .input('httpStatus', sql.Int, httpStatus || null)
    .input('latencyMs', sql.Int, latencyMs || null)
    .input('success', sql.Bit, success ? 1 : 0)
    .input('rawResponse', sql.NVarChar(sql.MAX), rawResponse ? JSON.stringify(rawResponse) : null)
    .input('normalizedResult', sql.NVarChar(sql.MAX), normalizedResult ? JSON.stringify(normalizedResult) : null)
    .input('errorMessage', sql.NVarChar(1000), errorMessage || null)
    .input('testedBy', sql.NVarChar(100), testedBy || null)
    .query(`
      INSERT INTO dbo.ApiConnectionTestLogs
        (ConnectionId, Action, VoucherCode, RequestUrl, HttpStatus, LatencyMs, Success,
         RawResponse, NormalizedResult, ErrorMessage, TestedBy, CreatedDate)
      VALUES
        (@connectionId, @action, @voucherCode, @requestUrl, @httpStatus, @latencyMs, @success,
         @rawResponse, @normalizedResult, @errorMessage, @testedBy, GETDATE())
    `);
}

module.exports = {
  KEEP_SECRET,
  getDefaults,
  validateCustomCaCert,
  list,
  listOptions,
  getById,
  getByIdDecrypted,
  getActiveDecrypted,
  getPrefixFilterConfig,
  matchPrefixFilter,
  validateCodePrefixFilterConfig,
  listPrefixFilterOnly,
  getPrefixFilterOnly,
  updatePrefixFilterOnly,
  create,
  update,
  activate,
  remove,
  setLocked,
  resolveDraftConfig,
  logTest,
};
