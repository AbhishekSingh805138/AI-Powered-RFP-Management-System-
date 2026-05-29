const multer = require('multer');
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production';

  // Always log server-side
  logger.error(err.message, {
    status: err.status,
    method: req.method,
    url: req.originalUrl,
    requestId: req.id,
    userId: req.user?.id,
    ...(isProduction ? {} : { stack: err.stack }),
  });

  // Multer file upload errors
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: 'File exceeds maximum allowed size',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field',
      LIMIT_FILE_COUNT: 'Too many files',
      LIMIT_FIELD_KEY: 'Field name too long',
      LIMIT_FIELD_VALUE: 'Field value too long',
      LIMIT_FIELD_COUNT: 'Too many fields',
      LIMIT_PART_COUNT: 'Too many parts',
    };
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: messages[err.code] || err.message });
  }

  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.errors.map((e) => ({ field: e.path, message: e.message })),
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      error: 'Duplicate Entry',
      details: err.errors.map((e) => ({ field: e.path, message: e.message })),
    });
  }

  const statusCode = err.status || 500;
  res.status(statusCode).json({
    error: statusCode === 500 && isProduction ? 'Internal Server Error' : err.message || 'Internal Server Error',
  });
}

module.exports = errorHandler;
