const authService = require('../services/authService');

async function register(req, res, next) {
  try {
    const { email, password, firstName, lastName } = req.body;
    const result = await authService.register({ email, password, firstName, lastName });
    res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshToken(refreshToken);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(401).json({ error: 'Invalid refresh token' });
  }
}

async function logout(req, res) {
  const accessToken = req.headers.authorization?.split(' ')[1];
  const { refreshToken } = req.body || {};
  authService.logout(accessToken, refreshToken);
  res.json({ message: 'Logged out successfully' });
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const currentAccessToken = req.headers.authorization?.split(' ')[1];
    const result = await authService.changePassword(req.user.id, { currentPassword, newPassword }, currentAccessToken);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await authService.getProfile(req.user.id);
    res.json(user);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

module.exports = { register, login, refresh, logout, changePassword, getMe };
