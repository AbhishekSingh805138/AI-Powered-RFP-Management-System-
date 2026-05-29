const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// In-memory token blacklist (replace with Redis in production at scale)
const tokenBlacklist = new Set();

/**
 * Add a token to the blacklist. It will be cleaned up when it naturally expires.
 */
function blacklistToken(token) {
  tokenBlacklist.add(token);
}

/**
 * Check if a token has been blacklisted.
 */
function isTokenBlacklisted(token) {
  return tokenBlacklist.has(token);
}

// Periodically clean expired tokens from the blacklist (every 30 minutes)
setInterval(() => {
  for (const token of tokenBlacklist) {
    try {
      // Try verifying with both secrets — if expired, remove from blacklist
      jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    } catch (e1) {
      try {
        jwt.verify(token, JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
      } catch (e2) {
        // Token is expired or invalid — safe to remove
        tokenBlacklist.delete(token);
      }
    }
  }
}, 30 * 60 * 1000).unref();

function generateTokens(user) {
  const payload = { id: user.id, email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { algorithm: 'HS256', expiresIn: REFRESH_TOKEN_EXPIRY });
  return { accessToken, refreshToken };
}

async function register({ email, password, firstName, lastName }) {
  const existing = await User.scope('withPassword').findOne({ where: { email } });
  if (existing) {
    const error = new Error('Email already registered');
    error.status = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ email, passwordHash, firstName, lastName });

  const tokens = generateTokens(user);
  return {
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
    ...tokens,
  };
}

async function login({ email, password }) {
  const user = await User.scope('withPassword').findOne({ where: { email } });
  if (!user) {
    const error = new Error('Invalid email or password');
    error.status = 401;
    throw error;
  }

  if (user.status === 'suspended') {
    const error = new Error('Account is suspended');
    error.status = 403;
    throw error;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const error = new Error('Invalid email or password');
    error.status = 401;
    throw error;
  }

  await user.update({ lastLoginAt: new Date() });
  const tokens = generateTokens(user);
  return {
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
    ...tokens,
  };
}

async function refreshToken(token) {
  if (isTokenBlacklisted(token)) {
    const error = new Error('Token has been revoked');
    error.status = 401;
    throw error;
  }

  const decoded = jwt.verify(token, JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
  const user = await User.findByPk(decoded.id);
  if (!user || user.status === 'suspended') {
    const error = new Error('Invalid refresh token');
    error.status = 401;
    throw error;
  }

  // Rotate: blacklist the old refresh token and issue a new pair
  blacklistToken(token);
  const tokens = generateTokens(user);
  return tokens;
}

function logout(accessToken, refreshTokenValue) {
  if (accessToken) blacklistToken(accessToken);
  if (refreshTokenValue) blacklistToken(refreshTokenValue);
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.scope('withPassword').findByPk(userId);
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    const error = new Error('Current password is incorrect');
    error.status = 401;
    throw error;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await user.update({ passwordHash });
  return { message: 'Password changed successfully' };
}

async function getProfile(userId) {
  const user = await User.findByPk(userId);
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }
  return user;
}

// For testing only — clear the in-memory blacklist
function _clearBlacklistForTest() {
  tokenBlacklist.clear();
}

module.exports = { register, login, refreshToken, logout, changePassword, getProfile, isTokenBlacklisted, _clearBlacklistForTest };
