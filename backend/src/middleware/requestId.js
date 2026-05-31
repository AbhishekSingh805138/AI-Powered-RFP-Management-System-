const crypto = require('crypto');

/**
 * Attaches a unique request ID to every incoming request.
 * Sets X-Request-Id response header for client-side correlation.
 */
function requestId(req, res, next) {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

module.exports = requestId;
