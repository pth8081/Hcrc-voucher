const axios = require('axios');
const { getByPath } = require('../utils/jsonPath');
const { renderPathTemplate, renderJsonValue } = require('../utils/template');

function buildAuthHeaders(connection) {
  const headers = {};
  if (connection.authType === 'BEARER' && connection.authToken) {
    headers.Authorization = `Bearer ${connection.authToken}`;
  } else if (connection.authType === 'API_KEY_HEADER' && connection.authToken) {
    headers[connection.apiKeyHeaderName || 'X-API-Key'] = connection.authToken;
  } else if (connection.authType === 'BASIC' && connection.basicUsername) {
    const token = Buffer.from(`${connection.basicUsername}:${connection.basicPassword || ''}`).toString('base64');
    headers.Authorization = `Basic ${token}`;
  }
  return headers;
}

function buildRequest(connection, phase, vars) {
  const prefix = phase === 'check' ? 'check' : 'redeem';
  const method = (connection[`${prefix}Method`] || 'GET').toUpperCase();
  const paramMode = connection[`${prefix}ParamMode`] || 'PATH';
  const paramName = connection[`${prefix}ParamName`] || (phase === 'check' ? 'voucherCode' : 'voucherCode');
  const bodyTemplate = connection[`${prefix}BodyTemplate`];

  const path = renderPathTemplate(connection[`${prefix}Path`], vars);
  const url = new URL(path, connection.baseUrl);

  if (paramMode === 'QUERY') {
    url.searchParams.set(paramName, vars.code);
  }

  let data;
  if (bodyTemplate) {
    data = renderJsonValue(bodyTemplate, vars);
  } else if (paramMode === 'BODY') {
    data = { [paramName]: vars.code };
  }

  const headers = { 'Content-Type': 'application/json', ...buildAuthHeaders(connection) };

  return { method, url: url.toString(), headers, data };
}

function normalize(mapping, body) {
  const statusRaw = getByPath(body, mapping.statusPath);
  const statusMapped =
    mapping.statusValueMap && statusRaw !== undefined && statusRaw !== null
      ? mapping.statusValueMap[String(statusRaw)] || mapping.statusValueMap[String(statusRaw).toUpperCase()]
      : undefined;

  return {
    found: mapping.foundPath ? !!getByPath(body, mapping.foundPath) : true,
    status: statusMapped || (statusRaw !== undefined && statusRaw !== null ? String(statusRaw).toUpperCase() : undefined),
    success: mapping.successPath ? !!getByPath(body, mapping.successPath) : undefined,
    voucherSerial: getByPath(body, mapping.serialPath),
    valueAmt: mapping.valueAmtPath ? numOrNull(getByPath(body, mapping.valueAmtPath)) : undefined,
    issueDate: getByPath(body, mapping.issueDatePath),
    expiryDate: getByPath(body, mapping.expiryDatePath),
    transRef: getByPath(body, mapping.transRefPath),
    redeemedAt: getByPath(body, mapping.redeemedAtPath),
    message: getByPath(body, mapping.messagePath),
  };
}

function numOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/**
 * Goi Core API theo cau hinh dong (connection) cho 1 hanh dong ('check' | 'redeem'),
 * tra ve ca ket qua tho (de hien thi debug/test) va ket qua da chuan hoa theo mapping.
 */
async function callDynamic(connection, phase, vars) {
  const mapping = phase === 'check' ? connection.checkMapping : connection.redeemMapping;
  const request = buildRequest(connection, phase, vars);
  const startedAt = Date.now();

  try {
    const response = await axios.request({
      method: request.method,
      url: request.url,
      headers: request.headers,
      data: request.data,
      timeout: connection.timeoutMs || 8000,
      validateStatus: (status) => status < 500, // tu xu ly 4xx, chi throw khi loi server/mang
    });

    const latencyMs = Date.now() - startedAt;

    if (response.status === 404) {
      return {
        httpStatus: 404,
        latencyMs,
        requestUrl: request.url,
        raw: response.data,
        normalized: { found: false, status: 'NOT_FOUND', message: 'Khong tim thay voucher tren he thong phat hanh' },
      };
    }

    if (response.status >= 400) {
      return {
        httpStatus: response.status,
        latencyMs,
        requestUrl: request.url,
        raw: response.data,
        normalized: { found: false, status: 'ERROR', message: `Core API tra ve loi HTTP ${response.status}` },
      };
    }

    return {
      httpStatus: response.status,
      latencyMs,
      requestUrl: request.url,
      raw: response.data,
      normalized: normalize(mapping, response.data),
    };
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const wrapped = new Error(err.message);
    wrapped.requestUrl = request.url;
    wrapped.latencyMs = latencyMs;
    wrapped.cause = err;
    throw wrapped;
  }
}

module.exports = { callDynamic, buildRequest };
