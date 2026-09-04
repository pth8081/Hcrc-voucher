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
          upgradeInsecureRequests: [],
        },
      },
      // Tat COEP: cac host ben ngoai (fonts.gstatic.com, unpkg.com) khong luon tra ve
      // header Cross-Origin-Resource-Policy phu hop, bat COEP se lam gian doan viec
      // tai font/thu vien camera. Cac header bao mat khac cua helmet van giu nguyen.
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(cors());
  // Nen gzip/brotli cho response (JSON API + static JS/CSS/HTML) - giam bang thong,
  // quan trong voi cac diem thu hoi co duong truyen yeu.
  app.use(compression());
  app.use(express.json());
  app.use(pinoHttp({ logger }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));
  app.use('/api', routes);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
