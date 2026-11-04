const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error({ err }, 'Unhandled error');
  const status = err.statusCode || 500;
  const body = {
    success: false,
    message: err.publicMessage || 'Da xay ra loi he thong',
  };
  // code/confirmToken: CHI 2 truong nay duoc "lo" ra ngoai tu doi tuong loi (khong spread tuy
  // tien ca err), phuc vu DUY NHAT truong hop sessionConflict() (authService.js) - frontend can
  // phan biet 1 loi "can hoi xac nhan" (SESSION_CONFLICT, kem confirmToken de hoan tat dang
  // nhap neu dong y) voi loi thong thuong. undefined o 2 truong nay (moi loi khac) tu dong bi
  // JSON.stringify bo qua, khong them gi vao response cu.
  if (err.code) body.code = err.code;
  if (err.confirmToken) body.confirmToken = err.confirmToken;
  res.status(status).json(body);
}

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: 'Khong tim thay tai nguyen' });
}

module.exports = { errorHandler, notFoundHandler };
