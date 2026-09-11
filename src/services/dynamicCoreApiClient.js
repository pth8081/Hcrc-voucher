const dns = require('dns').promises;
const axios = require('axios');
const { getByPath } = require('../utils/jsonPath');
const { renderPathTemplate, renderJsonValue } = require('../utils/template');

// H8: danh sach dia chi metadata cloud (AWS/GCP/Azure/Alibaba...) - noi duy nhat GAN NHU
// KHONG BAO GIO la dia chi that cua 1 Core Voucher API hop le (Core la he thong nghiep vu,
// khong phai dich vu metadata cua nha cung cap cloud), nhung neu goi toi duoc co the lo thong
// tin xac thuc cua ca may chu (SSRF kinh dien). CHU Y: co tinh KHONG chan toan bo dai IP noi
// bo/rieng tu (10.x/172.16.x/192.168.x...) vi Core thuong la 1 he thong legacy chay tren MANG
// NOI BO cua doanh nghiep - chan het se lam gay chinh chuc nang chinh cua app (khong ket noi
// duoc Core that). Day la danh doi co chu dich, uu tien khong lam gian doan nghiep vu.
const BLOCKED_HOSTS = new Set(['169.254.169.254', 'metadata.google.internal', 'metadata']);
const BLOCKED_IPV6 = new Set(['fd00:ec2::254']);
const DNS_LOOKUP_TIMEOUT_MS = 3000;

// URL.hostname tra ve dia chi IPv6 VOI dau ngoac vuong (vd "[fd00:ec2::254]"), khac voi chuoi
// KHONG ngoac trong BLOCKED_IPV6/ket qua dns.lookup() - neu so sanh thang se KHONG BAO GIO khop,
// khien toan bo danh sach chan IPv6 thanh "dead code" (da bi 1 dot ra soat sau phat hien).
function stripBrackets(host) {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

// Dia chi IPv4-mapped-IPv6 (vd "::ffff:169.254.169.254", hoac dang hex "::ffff:a9fe:a9fe" ma
// URL parser cua Node tu chuan hoa ve) tro toi CUNG 1 dia chi IPv4 that qua 1 lop dual-stack -
// day la 1 ky thuat bypass bo loc SSRF da biet, can quy doi ve dang IPv4 thuong de doi chieu.
function expandIPv4MappedIPv6(addr) {
  const m = addr.match(/^::ffff:(.+)$/i);
  if (!m) return null;
  let v4 = m[1];
  if (/^[0-9a-f]{1,4}:[0-9a-f]{1,4}$/i.test(v4)) {
    const parts = v4.split(':').map((h) => parseInt(h, 16));
    v4 = `${(parts[0] >> 8) & 0xff}.${parts[0] & 0xff}.${(parts[1] >> 8) & 0xff}.${parts[1] & 0xff}`;
  }
  return v4;
}

function isBlockedAddress(rawAddr) {
  const addr = stripBrackets(String(rawAddr)).toLowerCase();
  if (BLOCKED_HOSTS.has(addr) || BLOCKED_IPV6.has(addr)) return true;
  const mappedV4 = expandIPv4MappedIPv6(addr);
  return !!(mappedV4 && BLOCKED_HOSTS.has(mappedV4));
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('DNS lookup timeout')), ms)),
  ]);
}

async function assertHostAllowed(urlString) {
  const { hostname } = new URL(urlString);
  const bareHost = stripBrackets(hostname);
  if (isBlockedAddress(hostname)) {
    throw new Error(`Khong cho phep goi toi dia chi bi chan (metadata cloud): ${hostname}`);
  }
  // Chong DNS-rebinding: kiem tra ca dia chi IP THAT ma hostname phan giai ra, khong chi chuoi
  // hostname go trong cau hinh (1 domain hop le luc luu co the sau nay tro toi IP metadata).
  // Co timeout rieng (khong phu thuoc connection.timeoutMs) de 1 hostname phan giai cham khong
  // treo request vo thoi han truoc khi ca den buoc goi axios.
  try {
    const records = await withTimeout(dns.lookup(bareHost, { all: true }), DNS_LOOKUP_TIMEOUT_MS);
    for (const rec of records) {
      if (isBlockedAddress(rec.address)) {
        throw new Error(`Khong cho phep goi toi dia chi bi chan (metadata cloud, qua DNS): ${rec.address}`);
      }
    }
  } catch (err) {
    if (err.message && err.message.includes('bi chan')) throw err;
    // Loi DNS khac (khong phan giai duoc, timeout...) - de axios tu bao loi ket noi binh thuong.
  }
}

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
    await assertHostAllowed(request.url);
  } catch (err) {
    // Day la loi CHINH SACH (dia chi bi chan), khong phai loi ha tang tam thoi - khong duoc gan
    // nhap voi loi mat mang/Core down (coreUnreachable=true) de cac tang tren KHONG fail-open
    // coi day la su co mang binh thuong (xem H7 o duoi va ghi chu voucherService.js).
    err.coreUnreachable = false;
    err.blockedBySsrfGuard = true;
    throw err;
  }

  try {
    const response = await axios.request({
      method: request.method,
      url: request.url,
      headers: request.headers,
      data: request.data,
      timeout: connection.timeoutMs || 8000,
      maxRedirects: 0, // chan SSRF-qua-redirect: assertHostAllowed chi kiem tra 1 lan o URL goc,
      // neu axios tu dong theo 1 redirect (3xx) toi dia chi bi chan thi se KHONG duoc kiem tra lai.
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
    // H7: phan biet 2 nguyen nhan RAT KHAC NHAU nhung truoc day bi gop chung "khong ket noi
    // duoc Core": (a) that su KHONG CO PHAN HOI nao tu Core (mat mang/DNS/timeout/tu choi ket
    // noi - err.response rong) - day la loi ha tang thuc su; (b) Core CO PHAN HOI (vd 500, hoac
    // noi dung tra ve khong dung dang JSON nhu mong doi) - nghia la ket noi toi Core VAN thong,
    // rat co the la do sai cau hinh (mapping, path...) chu khong phai loi mang tam thoi. Ca 2
    // truong hop VAN duoc xu ly giong nhau o tang nghiep vu (van cho vao hang doi dong bo, xem
    // ghi chu o voucherService.js ve ly do fail-open co chu dich), nhung danh dau ro trong log
    // de admin biet huong kiem tra dung (mang/Core vs. cau hinh ket noi).
    const coreUnreachable = !err.response;

    // H9: xoa header xac thuc (Bearer/API key/Basic) khoi loi TRUOC KHI giu lai lam .cause -
    // logger.error ghi nguyen ca .cause (xem middleware/errorHandler.js), neu khong xoa thi
    // secret ket noi Core se bi ghi ra log dang chu thuong moi khi Core API loi.
    if (err.config) {
      err.config = { ...err.config, headers: '[REDACTED]' };
    }
    // axios gan CUNG 1 doi tuong config vao ca err.config LAN err.response.config - chi ghi de
    // err.config (tao object MOI) khong xoa duoc secret tren object GOC ma err.response.config
    // van con tro toi (da bi 1 dot ra soat sau phat hien). Phai xu ly rieng ca 2 duong.
    if (err.response && err.response.config) {
      err.response.config = { ...err.response.config, headers: '[REDACTED]' };
    }
    delete err.request; // doi tuong ClientRequest cua Node, khong can cho debug va co the rat lon
    if (err.response) delete err.response.request;
    const wrapped = new Error(err.message);
    wrapped.requestUrl = request.url;
    wrapped.latencyMs = latencyMs;
    wrapped.coreUnreachable = coreUnreachable;
    wrapped.cause = err;
    throw wrapped;
  }
}

module.exports = { callDynamic, buildRequest };
