const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const pinoHttp = require('pino-http');
const path = require('path');
const logger = require('./utils/logger');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  // H2: app luon chay sau 1 reverse proxy (nginx tren CUNG may, proxy_pass toi 127.0.0.1 -
  // xem README muc 3f) nen ket noi TCP thuc su luon den tu localhost. Khai bao "loopback" de
  // Express tin tuong header X-Forwarded-For DO nginx forward (dia chi IP that cua trinh
  // duyet) va tra ve dung trong req.ip - can thiet de rate-limit theo IP (ipRateLimit.js) va
  // ghi log (VoucherScanLogs.ClientIp) phan anh dung nguoi dung that, khong phai luon la
  // 127.0.0.1. KHONG anh huong gi neu chua chay sau proxy (dev/local).
  app.set('trust proxy', 'loopback');

  // CSP nghiem ngat: KHONG unsafe-inline / unsafe-eval o bat ky directive nao.
  // Moi CSS/JS deu nam trong file rieng (khong con <style>/<script> inline hay
  // thuoc tinh style="..."), chi allowlist dung cac host ben ngoai thuc su can:
  // Google Fonts (style/font) va unpkg (thu vien quet QR bang camera).
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://unpkg.com'],
          styleSrc: ["'self'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
          mediaSrc: ["'self'", 'blob:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          manifestSrc: ["'self'"],
          workerSrc: ["'self'"],
          upgradeInsecureRequests: [],
        },
      },
      // Tat COEP: cac host ben ngoai (fonts.gstatic.com, unpkg.com) khong luon tra ve
      // header Cross-Origin-Resource-Policy phu hop, bat COEP se lam gian doan viec
      // tai font/thu vien camera. Cac header bao mat khac cua helmet van giu nguyen.
      crossOriginEmbedderPolicy: false,
      // L3: khai bao ro rang thay vi de mac dinh cua helmet (co the doi giua cac phien ban) -
      // 1 nam + includeSubDomains, ep trinh duyet LUON goi qua HTTPS voi domain nay sau lan
      // truy cap dau, chan duoc kieu tan cong ha cap giao thuc (SSL stripping / MITM tren
      // mang khong tin cay, vd wifi cong cong). preload=false vi domain noi bo, khong dang ky
      // vao danh sach preload cua trinh duyet cong khai.
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: false,
      },
    })
  );

  // L2: Permissions-Policy - tat cac quyen trinh duyet KHONG dung toi (dinh vi, micro, thanh
  // toan, usb, cam bien chuyen dong...) cho ca trang nay LAN moi iframe con (neu co), chi giu
  // lai camera=(self) vi trang quet.html dung camera de quet QR. Giam be mat tan cong neu 1
  // trang bi chen script doc hai (XSS) co gang lam dung cac API trinh duyet nhay cam nay.
  app.use((req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), camera=(self)'
    );
    next();
  });

  // M10: cors() mac dinh (khong tham so) phan xa lai Access-Control-Allow-Origin dung BANG
  // origin cua request goi len - nghia la BAT KY trang web nao cung duoc trinh duyet cho phep
  // doc phan hoi JSON tu API nay. App nay chi chay 1 domain noi bo duy nhat (frontend tinh +
  // API cung 1 origin, xem README muc 3f) nen khong can mo CORS - thu hep theo nguyen tac it
  // dac quyen nhat. Khong dung cookie de xac thuc (Bearer token trong header, trinh duyet
  // KHONG tu dong gui kem nhu cookie) nen rui ro thuc te thap, day la phong ho dinh huong dung
  // (defense-in-depth) hon la 1 lo hong da khai thac duoc. CORS_ORIGIN (phan cach dau phay,
  // vd "https://a.example.com,https://b.example.com") de mo them cho domain khac neu can (vd
  // 1 ung dung/portal rieng goi thang API nay sau nay) - khong dat = chi same-origin (trinh
  // duyet luon cho goi same-origin binh thuong, khong phu thuoc cau hinh CORS).
  const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : { origin: false }));
  // Nen gzip/brotli cho response (JSON API + static JS/CSS/HTML) - giam bang thong,
  // quan trong voi cac diem thu hoi co duong truyen yeu.
  app.use(compression());
  app.use(express.json());
  // redact: khong ghi token dang nhap/xac thuc vao log server - header Authorization mang
  // nguyen ban JWT (hoac cookie 2FA/refresh neu co), lo ra la co the chiem dung phien dang nhap.
  app.use(
    pinoHttp({
      logger,
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        remove: true,
      },
    })
  );
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Nguon xac nhan version DANG THUC SU CHAY doc lap voi "pm2 status" (cot Version cua pm2 chi
  // doc dung neu tien trinh duoc dang ky dung cach - xem README muc 3e) - goi endpoint nay hoac
  // xem dong log luc khoi dong (server.js) de biet chac chan dang chay ban nao, khong phu thuoc
  // pm2 co hien thi dung hay khong.
  const { version } = require('../package.json');
  app.get('/health', (req, res) => res.json({ success: true, status: 'ok', version }));
  app.use('/api', routes);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
