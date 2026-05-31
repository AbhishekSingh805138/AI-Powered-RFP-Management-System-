const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const errorHandler = require('./middleware/errorHandler');
const requestId = require('./middleware/requestId');
const logger = require('./utils/logger');

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
const analyticsRoutes = require('./routes/analyticsRoutes');
const jobRoutes = require('./routes/jobRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

function createApp() {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';

  // Request ID for audit trails
  app.use(requestId);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
  }));
  
  app.use(compression());
  
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // HTTP request logging with request ID
  morgan.token('request-id', (req) => req.id);
  morgan.token('user-id', (req) => req.user?.id || '-');
  const morganFormat = isProduction
    ? ':request-id :remote-addr :method :url :status :res[content-length] - :response-time ms :user-id'
    : ':request-id :method :url :status :response-time ms';
  app.use(morgan(morganFormat, {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip: (req) => req.url === '/api/health' || req.url === '/api/healthz' || req.url === '/api/ready',
  }));

  // Rate limiting — disabled in test to avoid flaky tests
  if (process.env.NODE_ENV !== 'test') {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: isProduction ? 100 : 1000,
      message: { error: 'Too many requests, please try again later.' },
    });
    app.use('/api/', limiter);

    // AI endpoints get stricter rate limits to control costs
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

  // Liveness probe — is the process alive? (lightweight, no external deps)
  app.get('/api/healthz', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Readiness probe — is the app ready to serve traffic? (checks dependencies)
  app.get('/api/ready', async (req, res) => {
    const checks = { database: 'unknown' };
    let healthy = true;

    try {
      const { sequelize } = require('./models');
      await sequelize.authenticate();
      checks.database = 'connected';
    } catch (err) {
      checks.database = 'disconnected';
      healthy = false;
    }

    const status = healthy ? 'ready' : 'not_ready';
    res.status(healthy ? 200 : 503).json({ status, timestamp: new Date().toISOString(), checks });
  });

  // Backwards-compatible health endpoint
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
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/notifications', notificationRoutes);

  // Error handler
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
