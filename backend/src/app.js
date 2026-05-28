/**
 * Express app factory — separated from server.js so supertest can import the app
 * without starting the HTTP listener or requiring a live database connection.
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const { authenticate } = require('./middleware/auth');
const rfpRoutes = require('./routes/rfpRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const proposalRoutes = require('./routes/proposalRoutes');
const rfpDocumentRoutes = require('./routes/rfpDocumentRoutes');
const searchRoutes = require('./routes/searchRoutes');
const complianceRoutes = require('./routes/complianceRoutes');
const riskRoutes = require('./routes/riskRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminRoutes = require('./routes/adminRoutes');

function createApp() {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';

  // Security middleware
  app.use(helmet());
  app.use(compression());
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Rate limiting — disabled in test to avoid flaky tests
  if (process.env.NODE_ENV !== 'test') {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: isProduction ? 100 : 1000,
      message: { error: 'Too many requests, please try again later.' },
    });
    app.use('/api/', limiter);

    const aiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: isProduction ? 20 : 100,
      message: { error: 'Too many AI requests, please try again later.' },
    });
    app.use('/api/rfps', (req, res, next) => {
      if (req.method === 'POST' && (req.path === '/' || req.path.endsWith('/compare'))) {
        return aiLimiter(req, res, next);
      }
      next();
    });
    app.use('/api/proposals/:id/parse', aiLimiter);
    app.use('/api/rfp-documents', (req, res, next) => {
      if (req.method === 'POST' && (req.path.endsWith('/extract') || req.path.endsWith('/generate'))) {
        return aiLimiter(req, res, next);
      }
      next();
    });
    app.use('/api/search', (req, res, next) => {
      if (req.method === 'POST' && (req.path === '/' || req.path.startsWith('/index'))) {
        return aiLimiter(req, res, next);
      }
      next();
    });
    app.use('/api/compliance/check', aiLimiter);
    app.use('/api/risk-analysis', (req, res, next) => {
      if (req.method === 'POST') return aiLimiter(req, res, next);
      next();
    });
    app.use('/api/chat/conversations', (req, res, next) => {
      if (req.method === 'POST' && req.path.endsWith('/messages')) return aiLimiter(req, res, next);
      next();
    });
  }

  app.use(express.json({ limit: '2mb' }));

  // Public routes (no auth required)
  app.use('/api/auth', authRoutes);
  app.get('/api/health', async (req, res) => {
    try {
      const { sequelize } = require('./models');
      await sequelize.authenticate();
      res.json({ status: 'ok', timestamp: new Date().toISOString(), database: 'connected' });
    } catch (err) {
      res.status(503).json({ status: 'unhealthy', timestamp: new Date().toISOString(), database: 'disconnected' });
    }
  });

  // Auth wall — all routes below require authentication
  app.use('/api', authenticate);

  // Protected routes
  app.use('/api/rfps', rfpRoutes);
  app.use('/api/vendors', vendorRoutes);
  app.use('/api/proposals', proposalRoutes);
  app.use('/api/rfp-documents', rfpDocumentRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/compliance', complianceRoutes);
  app.use('/api/risk-analysis', riskRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/admin', adminRoutes);

  // Error handler
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
