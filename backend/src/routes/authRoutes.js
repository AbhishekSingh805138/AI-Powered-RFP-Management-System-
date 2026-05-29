const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { registerSchema, loginSchema, refreshTokenSchema, changePasswordSchema } = require('../middleware/validationSchemas');
const authController = require('../controllers/authController');

// Strict rate limiting for auth endpoints (brute-force protection)
const authLimiter = process.env.NODE_ENV !== 'test'
  ? rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // 10 attempts per window
      message: { error: 'Too many authentication attempts, please try again later.' },
      standardHeaders: true,
      legacyHeaders: false,
    })
  : (req, res, next) => next();

// Public routes
router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authLimiter, validate(refreshTokenSchema), authController.refresh);

// Protected routes
router.get('/me', authenticate, authController.getMe);
router.post('/logout', authenticate, authController.logout);
router.put('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);

module.exports = router;
