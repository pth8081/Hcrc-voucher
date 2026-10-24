const nodemailer = require('nodemailer');
const { sql, getPool } = require('../config/db');
const { encrypt, decrypt } = require('../utils/crypto');

// Gia tri dac biet FE gui len khi KHONG doi mat khau da luu (giong het quy uoc KEEP_SECRET cua
// apiConnectionService.js) - tranh phai hien mat khau that ra lai man hinh de "giu nguyen".
const KEEP_SECRET = '__KEEP__';

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.publicMessage = message;
  return err;
}

/** Cau hinh gui mail CHI 1 dong duy nhat trong he thong - luon lay dong MOI NHAT (phong truong
 * hop co nhieu dong "rac" tu truoc, tuy thuc te chi nen co 1). Tra ve null neu CHUA tung cau hinh. */
async function getRawRow() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT TOP 1 Id, Host, Port, Secure, RejectUnauthorized, Username, PasswordEncrypted,
           FromEmail, FromName, UpdatedBy, UpdatedDate
    FROM dbo.EmailGatewayConfig
    ORDER BY Id DESC
  `);
  return result.recordset[0] || null;
}

/** Cau hinh DA GIAI MA (mat khau that) - CHI dung noi bo khi THAT SU can goi SMTP (buildTransporter),
 * khong bao gio tra ve qua API cho frontend. */
async function getDecryptedConfig() {
  const row = await getRawRow();
  if (!row) return null;
  return {
    id: row.Id,
    host: row.Host,
    port: row.Port,
    secure: !!row.Secure,
    rejectUnauthorized: !!row.RejectUnauthorized,
    username: row.Username,
    password: decrypt(row.PasswordEncrypted),
    fromEmail: row.FromEmail,
    fromName: row.FromName,
  };
}

/** Cau hinh cho man hinh "Thiet lap email" - mat khau LUON an (khong tra ve ca dang ma hoa), chi
 * bao co dang luu hay chua de giao dien quyet dinh hien placeholder nao. */
async function getMaskedConfig() {
  const row = await getRawRow();
  if (!row) return null;
  return {
    host: row.Host,
    port: row.Port,
    secure: !!row.Secure,
    rejectUnauthorized: !!row.RejectUnauthorized,
    username: row.Username,
    hasPassword: !!row.PasswordEncrypted,
    fromEmail: row.FromEmail,
    fromName: row.FromName,
    updatedBy: row.UpdatedBy,
    updatedDate: row.UpdatedDate,
  };
}

/** Luu cau hinh - CHI 1 dong duy nhat (xoa dong cu + them dong moi trong 1 transaction, don gian
 * hon MERGE vi khong co khoa chinh co dinh de so khop "dong duy nhat"). password = KEEP_SECRET
 * hoac rong -> giu nguyen mat khau da luu (doc tu dong hien co truoc khi xoa). */
async function saveConfig(data, updatedBy) {
  const host = String(data.host || '').trim();
  if (!host) throw badRequest('Thieu dia chi may chu SMTP (Host)');
  const port = Number(data.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw badRequest('Cong (Port) khong hop le');
  const fromEmail = String(data.fromEmail || '').trim();
  if (!fromEmail) throw badRequest('Thieu dia chi email gui (From)');

  const existing = await getRawRow();
  const keepPassword = !data.password || data.password === KEEP_SECRET;
  const passwordEncrypted = keepPassword ? (existing ? existing.PasswordEncrypted : null) : encrypt(data.password);

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await transaction.request().query('DELETE FROM dbo.EmailGatewayConfig');
    await transaction
      .request()
      .input('host', sql.NVarChar(255), host)
      .input('port', sql.Int, port)
      .input('secure', sql.Bit, data.secure ? 1 : 0)
      .input('rejectUnauthorized', sql.Bit, data.rejectUnauthorized === false ? 0 : 1)
      .input('username', sql.NVarChar(255), data.username || null)
      .input('passwordEncrypted', sql.NVarChar(sql.MAX), passwordEncrypted)
      .input('fromEmail', sql.NVarChar(255), fromEmail)
      .input('fromName', sql.NVarChar(200), data.fromName || null)
      .input('updatedBy', sql.NVarChar(100), updatedBy || null)
      .query(`
        INSERT INTO dbo.EmailGatewayConfig
          (Host, Port, Secure, RejectUnauthorized, Username, PasswordEncrypted, FromEmail, FromName, UpdatedBy, UpdatedDate)
        VALUES
          (@host, @port, @secure, @rejectUnauthorized, @username, @passwordEncrypted, @fromEmail, @fromName, @updatedBy, GETDATE())
      `);
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

function buildTransporter(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.username ? { user: config.username, pass: config.password } : undefined,
    tls: { rejectUnauthorized: config.rejectUnauthorized },
  });
}

/** Gui 1 email that su - dung CHUNG boi "Gui thu" (man hinh Thiet lap email) va job gui bao cao
 * tu dong (emailScheduleService.js). Nem loi ro rang (publicMessage) neu CHUA cau hinh gateway. */
async function sendMail({ to, subject, html, attachments }) {
  const config = await getDecryptedConfig();
  if (!config) {
    throw badRequest('Chua cau hinh may chu gui email (SMTP) - vao "Thiet lap email" de cau hinh truoc.');
  }
  const transporter = buildTransporter(config);
  await transporter.sendMail({
    from: config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail,
    to,
    subject,
    html,
    attachments,
  });
}

async function sendTestEmail(toEmail) {
  const trimmed = String(toEmail || '').trim();
  if (!trimmed) throw badRequest('Thieu email nhan thu');
  await sendMail({
    to: trimmed,
    subject: 'Email thu - Hệ thống thu hồi voucher HCRC',
    html: '<p>Đây là email thử để xác nhận cấu hình máy chủ gửi email (SMTP) đang hoạt động đúng.</p>',
  });
}

module.exports = {
  KEEP_SECRET,
  getMaskedConfig,
  getDecryptedConfig,
  saveConfig,
  sendMail,
  sendTestEmail,
};
