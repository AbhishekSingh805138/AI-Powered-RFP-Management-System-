const { v4: uuidv4 } = require('uuid');

/**
 * Attaches a unique request ID to every incoming request.
 * Sets X-Request-Id response header for client-side correlation.
 */
function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
}

module.exports = requestId;
