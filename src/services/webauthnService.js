const crypto = require('crypto');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const { sql, getPool } = require('../config/db');
const authService = require('./authService');
const loginGuard = require('../utils/loginGuard');

const RP_NAME = process.env.WEBAUTHN_RP_NAME || 'HCRC Voucher Redemption';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';

const CHALLENGE_TTL_MS = 2 * 60 * 1000; // 2 phut de hoan tat 1 lot dang ky/dang nhap
const pendingChallenges = new Map(); // flowId -> { challenge, userId, expiresAt }

setInterval(() => {
  const now = Date.now();
  for (const [flowId, entry] of pendingChallenges) {
    if (now > entry.expiresAt) pendingChallenges.delete(flowId);
  }
}, 60 * 1000).unref?.();

function putChallenge(challenge, userId) {
  const flowId = crypto.randomBytes(16).toString('hex');
  pendingChallenges.set(flowId, { challenge, userId: userId || null, expiresAt: Date.now() + CHALLENGE_TTL_MS });
  return flowId;
}

function takeChallenge(flowId) {
  const entry = pendingChallenges.get(flowId);
  if (!entry) return null;
  pendingChallenges.delete(flowId);
  if (Date.now() > entry.expiresAt) return null;
  return entry;
}

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.publicMessage = message;
  return err;
}

function safeParseTransports(json) {
  if (!json) return undefined;
  try {
    return JSON.parse(json);
  } catch (e) {
    return undefined;
  }
}

// =====================================================================
// Dang ky passkey cho thiet bi hien tai - BAT BUOC nguoi dung da dang
// nhap bang mat khau truoc (buoc thiet lap lan dau), sau do moi dang
// nhap lai bang van tay/Face ID duoc.
// =====================================================================

async function getRegistrationOptions(user) {
  const existing = await listCredentialsByUser(user.userId);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: user.username,
    userID: Buffer.from(String(user.userId)),
    userDisplayName: user.fullName || user.username,
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({
      id: c.CredentialId,
      transports: safeParseTransports(c.Transports),
    })),
    authenticatorSelection: {
      // 'required' -> tao "discoverable credential", dieu kien bat buoc de thiet bi dung
      // chung tai quay co the tu hien bang chon tai khoan khi dang nhap (khong can go ten).
      residentKey: 'required',
      userVerification: 'required',
      authenticatorAttachment: 'platform',
    },
  });

  const flowId = putChallenge(options.challenge, user.userId);
  return { options, flowId };
}

async function verifyRegistration({ flowId, userId, response, deviceLabel }) {
  const entry = takeChallenge(flowId);
  if (!entry || entry.userId !== userId) {
    throw badRequest('Phien dang ky da het han, vui long thu lai.');
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: entry.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });
  } catch (err) {
    throw badRequest('Khong xac thuc duoc thiet bi: ' + err.message);
  }

  if (!verification.verified || !verification.registrationInfo) {
    throw badRequest('Khong xac thuc duoc thiet bi, vui long thu lai.');
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  await saveCredential({
    userId,
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64'),
    counter: credential.counter,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    transports: credential.transports || [],
    deviceLabel: deviceLabel || null,
  });

  return { success: true };
}

// =====================================================================
// Dang nhap bang van tay/Face ID - KHONG can biet truoc ten dang nhap.
// Khong dat allowCredentials de trinh duyet/he dieu hanh tu hien bang
// chon tai khoan tren thiet bi (dung cho thiet bi dung chung tai quay -
// giong chinh xac UI "Doi tai khoan" trong anh tham khao, nhung do OS
// tu ve chu khong phai app tu dung).
// =====================================================================

async function getAuthenticationOptions() {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'required',
  });
  const flowId = putChallenge(options.challenge, null);
  return { options, flowId };
}

async function verifyAuthentication({ flowId, response }) {
  const entry = takeChallenge(flowId);
  if (!entry) {
    throw badRequest('Phien dang nhap da het han, vui long thu lai.');
  }

  const stored = await getCredentialByCredentialId(response.id);
  // Dung badRequest (400) thay vi 401 cho toan bo nhanh loi o day: day la endpoint CONG
  // KHAI (chua co phien dang nhap nao), trong khi client (api.js) coi MOI 401 la "phien
  // het han" va tu dong redirect ve /login.html - se gay vong lap ky la tren chinh trang
  // dang nhap. 401 chi con danh cho cac API can JWT hop le (xem middleware/auth.js).
  if (!stored) {
    // Khong biet duoc credential nay thuoc ve ai (id la 1 gia tri khong the doan duoc, khac
    // mat khau/OTP) nen khong co username de tinh vao loginGuard - khong phai lo hong that
    // vi khong the "do" duoc credential id qua mang.
    throw badRequest('Thiet bi/sinh trac hoc nay chua duoc dang ky tren he thong.');
  }

  // Biet duoc tai khoan dich tu day (qua credential da dang ky) - ap dung cung 1 chinh sach
  // khoa dang nhap voi duong mat khau/OTP (xem loginGuard.js) truoc khi thu xac thuc chu ky.
  const user = await authService.findUserById(stored.UserId);
  if (!user) {
    throw badRequest('Tai khoan gan voi thiet bi nay khong con hoat dong.');
  }
  const role = authService.roleOf(user);
  loginGuard.assertNotLocked(user.Username);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: entry.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: stored.CredentialId,
        publicKey: Buffer.from(stored.PublicKey, 'base64'),
        counter: Number(stored.Counter),
        transports: safeParseTransports(stored.Transports),
      },
    });
  } catch (err) {
    loginGuard.recordResult(user.Username, false, role);
    throw badRequest('Xac thuc sinh trac hoc that bai: ' + err.message);
  }

  if (!verification.verified) {
    loginGuard.recordResult(user.Username, false, role);
    throw badRequest('Xac thuc sinh trac hoc that bai.');
  }

  await updateCredentialAfterUse(stored.Id, verification.authenticationInfo.newCounter);
  loginGuard.recordResult(user.Username, true, role);

  // Van tay/Face ID xac minh danh tinh, nhung tai khoan quan tri van phai qua buoc xac thuc
  // hai yeu to (TOTP) rieng truoc khi duoc cap phien day du - xem authService.buildLoginOutcome.
  return authService.buildLoginOutcome(user);
}

// =====================================================================
// Truy van / quan tri credential
// =====================================================================

async function listCredentialsByUser(userId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT Id, CredentialId, DeviceLabel, DeviceType, CreatedDate, LastUsedDate, Transports
      FROM dbo.WebAuthnCredentials
      WHERE UserId = @userId
      ORDER BY CreatedDate DESC
    `);
  return result.recordset;
}

async function getCredentialByCredentialId(credentialId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('credentialId', sql.NVarChar(400), credentialId)
    .query('SELECT * FROM dbo.WebAuthnCredentials WHERE CredentialId = @credentialId');
  return result.recordset[0] || null;
}

async function saveCredential({ userId, credentialId, publicKey, counter, deviceType, backedUp, transports, deviceLabel }) {
  const pool = await getPool();
  await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('credentialId', sql.NVarChar(400), credentialId)
    .input('publicKey', sql.NVarChar(sql.MAX), publicKey)
    .input('counter', sql.BigInt, counter)
    .input('deviceType', sql.NVarChar(20), deviceType || null)
    .input('backedUp', sql.Bit, backedUp ? 1 : 0)
    .input('transports', sql.NVarChar(200), transports && transports.length ? JSON.stringify(transports) : null)
    .input('deviceLabel', sql.NVarChar(200), deviceLabel)
    .query(`
      INSERT INTO dbo.WebAuthnCredentials
        (UserId, CredentialId, PublicKey, Counter, DeviceType, Backed_Up, Transports, DeviceLabel, CreatedDate)
      VALUES
        (@userId, @credentialId, @publicKey, @counter, @deviceType, @backedUp, @transports, @deviceLabel, GETDATE())
    `);
}

async function updateCredentialAfterUse(id, newCounter) {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('counter', sql.BigInt, newCounter)
    .query('UPDATE dbo.WebAuthnCredentials SET Counter = @counter, LastUsedDate = GETDATE() WHERE Id = @id');
}

async function deleteCredential(userId, id) {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('userId', sql.Int, userId)
    .query('DELETE FROM dbo.WebAuthnCredentials WHERE Id = @id AND UserId = @userId');
}

module.exports = {
  getRegistrationOptions,
  verifyRegistration,
  getAuthenticationOptions,
  verifyAuthentication,
  listCredentialsByUser,
  deleteCredential,
};
