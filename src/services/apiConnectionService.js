const { sql, getPool } = require('../config/db');
const { encrypt, decrypt } = require('../utils/crypto');

const KEEP_SECRET = '__KEEP__'; // gia tri dac biet FE gui len khi khong doi secret da luu

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

function getDefaults() {
  return {
    checkMapping: DEFAULT_CHECK_MAPPING,
    redeemMapping: DEFAULT_REDEEM_MAPPING,
    checkPath: '/api/vouchers/{code}/status',
    redeemPath: '/api/vouchers/{code}/redeem',
    redeemBodyTemplate: {
      voucherCode: '{code}',
      redeemedBy: '{username}',
      locationsGroup: '{locationsGroup}',
      locationsDetail: '{locationsDetail}',
      transNum: '{transNum}',
    },
  };
}

function toRow(data) {
  return {
    name: data.name,
    baseUrl: data.baseUrl,
    authType: data.authType || 'NONE',
    apiKeyHeaderName: data.apiKeyHeaderName || null,
    basicUsername: data.basicUsername || null,
    timeoutMs: Number(data.timeoutMs) || 8000,

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

async function getByIdDecrypted(id) {
  const pool = await getPool();
  const result = await pool.request().input('id', sql.Int, id).query('SELECT * FROM dbo.ApiConnections WHERE Id = @id');
  return result.recordset[0] ? toDecryptedConfig(result.recordset[0]) : null;
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
    .input('updatedBy', sql.NVarChar(100), data.updatedBy || null)
    .query(`
      INSERT INTO dbo.ApiConnections
        (Name, IsActive, BaseUrl, AuthType, AuthTokenEncrypted, ApiKeyHeaderName, BasicUsername,
         BasicPasswordEncrypted, TimeoutMs, CheckMethod, CheckPath, CheckParamMode, CheckParamName,
         CheckBodyTemplate, CheckMapping, RedeemMethod, RedeemPath, RedeemParamMode, RedeemParamName,
         RedeemBodyTemplate, RedeemMapping, CreatedDate, UpdatedBy)
      OUTPUT INSERTED.Id
      VALUES
        (@name, 0, @baseUrl, @authType, @authTokenEncrypted, @apiKeyHeaderName, @basicUsername,
         @basicPasswordEncrypted, @timeoutMs, @checkMethod, @checkPath, @checkParamMode, @checkParamName,
         @checkBodyTemplate, @checkMapping, @redeemMethod, @redeemPath, @redeemParamMode, @redeemParamName,
         @redeemBodyTemplate, @redeemMapping, GETDATE(), @updatedBy)
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
    .input('updatedBy', sql.NVarChar(100), data.updatedBy || null);

  let secretSet = '';
  if (data.authToken !== undefined && data.authToken !== KEEP_SECRET) {
    request.input('authTokenEncrypted', sql.NVarChar(1000), encrypt(data.authToken));
    secretSet += ', AuthTokenEncrypted = @authTokenEncrypted';
  }
  if (data.basicPassword !== undefined && data.basicPassword !== KEEP_SECRET) {
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
      UpdatedDate = GETDATE(), UpdatedBy = @updatedBy
      ${secretSet}
    WHERE Id = @id
  `);
}

async function activate(id) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await transaction.request().query('UPDATE dbo.ApiConnections SET IsActive = 0');
    await transaction.request().input('id', sql.Int, id).query('UPDATE dbo.ApiConnections SET IsActive = 1 WHERE Id = @id');
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function remove(id) {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.ApiConnections WHERE Id = @id');
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
    timeoutMs: Number(data.timeoutMs) || 8000,

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
  list,
  getById,
  getByIdDecrypted,
  getActiveDecrypted,
  create,
  update,
  activate,
  remove,
  resolveDraftConfig,
  logTest,
};
