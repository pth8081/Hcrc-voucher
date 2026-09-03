const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');
const path = require('path');
const logger = require('./utils/logger');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.use(cors());
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
