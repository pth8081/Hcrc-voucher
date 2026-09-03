const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error({ err }, 'Unhandled error');
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.publicMessage || 'Da xay ra loi he thong',
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: 'Khong tim thay tai nguyen' });
}

module.exports = { errorHandler, notFoundHandler };
