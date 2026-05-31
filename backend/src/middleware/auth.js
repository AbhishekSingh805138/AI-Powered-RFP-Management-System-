const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { isTokenBlacklisted } = require('../services/authService');

const ROLE_PERMISSIONS = {
  admin: ['*'],
  manager: [
    'rfp:read', 'rfp:write', 'rfp:delete',
    'proposal:read', 'proposal:write', 'proposal:finalize', 'proposal:compare',
    'vendor:read', 'vendor:write',
    'compliance:check', 'risk:manage',
    'search:query', 'search:index',
    'chat:access', 'chat:delete',
    'analytics:read'
  ],
  viewer: [
    'rfp:read',
    'proposal:read',
    'vendor:read',
    'search:query',
    'chat:access'
  ]
};

function hasPermission(user, permission) {
  if (!user || user.status !== 'active') return false;
  const permissions = ROLE_PERMISSIONS[user.role] || [];
  return permissions.includes('*') || permissions.includes(permission);
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.split(' ')[1];
  try {
    if (isTokenBlacklisted(token)) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const user = await User.findByPk(decoded.id);
    if (!user || user.status === 'suspended') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, requirePermission, requireRole };
