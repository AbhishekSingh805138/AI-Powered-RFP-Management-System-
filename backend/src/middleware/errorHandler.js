function errorHandler(err, req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production';

  // Always log server-side
  console.error('Error:', err.message);
  if (!isProduction) {
    console.error(err.stack);
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
