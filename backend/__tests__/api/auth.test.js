/**
 * API endpoint tests for /api/auth (Phase 4 — Authentication).
 */

process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'rfp_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock models
const mockModels = {
  RfpDocument: { findByPk: jest.fn(), findAll: jest.fn(), create: jest.fn() },
  GeneratedProposal: { findByPk: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), create: jest.fn(), count: jest.fn(), destroy: jest.fn() },
  RiskAnalysis: { create: jest.fn(), findByPk: jest.fn(), findAll: jest.fn() },
  ChatConversation: { create: jest.fn(), findByPk: jest.fn(), findAll: jest.fn(), update: jest.fn() },
  ChatMessage: { create: jest.fn(), findAll: jest.fn(), count: jest.fn(), destroy: jest.fn() },
  Rfp: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  Vendor: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  RfpVendor: { findOrCreate: jest.fn() },
  Proposal: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn(), update: jest.fn() },
  Comparison: { create: jest.fn() },
  DocumentEmbedding: {},
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    scope: jest.fn(function () { return this; }),
  },
  sequelize: { authenticate: jest.fn(), sync: jest.fn(), close: jest.fn() },
};
jest.mock('../../src/models', () => mockModels);
jest.mock('../../src/config/database', () => ({}));
jest.mock('../../src/services/riskService', () => ({ analyzeRisks: jest.fn(), compareRiskProfiles: jest.fn() }));
jest.mock('../../src/services/chatService', () => ({
  chat: jest.fn(), generateConversationTitle: jest.fn(), getSuggestedQuestions: jest.fn(),
}));
jest.mock('../../src/services/aiService', () => ({
  parseRfpFromNaturalLanguage: jest.fn(), parseVendorProposal: jest.fn(),
  compareProposals: jest.fn(), extractRequirements: jest.fn(), generateProposal: jest.fn(),
}));
jest.mock('../../src/services/embeddingService', () => ({
  indexDocument: jest.fn(), semanticSearch: jest.fn(), getIndexStats: jest.fn(),
}));
jest.mock('../../src/services/searchService', () => ({ ragSearch: jest.fn() }));
jest.mock('../../src/services/complianceService', () => ({ checkCompliance: jest.fn() }));
jest.mock('../../src/services/emailService', () => ({
  sendRfpEmail: jest.fn(), fetchInboundEmails: jest.fn().mockResolvedValue([]),
}));
jest.mock('pdf-parse', () => jest.fn());

const { createApp } = require('../../src/app');
const app = createApp();

describe('Auth API — /api/auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /register', () => {
    test('returns 400 if fields are missing', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: 'a@b.com' });
      expect(res.status).toBe(400);
    });

    test('returns 400 if password is too short', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'a@b.com', password: '123', firstName: 'A', lastName: 'B',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'password' })])
      );
    });

    test('returns 409 if email is already registered', async () => {
      mockModels.User.findOne.mockResolvedValue({ id: 1, email: 'dup@test.com' });
      const res = await request(app).post('/api/auth/register').send({
        email: 'dup@test.com', password: 'Password123', firstName: 'A', lastName: 'B',
      });
      expect(res.status).toBe(409);
    });

    test('registers successfully and returns tokens', async () => {
      mockModels.User.findOne.mockResolvedValue(null);
      mockModels.User.create.mockResolvedValue({
        id: 1, email: 'new@test.com', firstName: 'New', lastName: 'User', role: 'viewer',
      });

      const res = await request(app).post('/api/auth/register').send({
        email: 'new@test.com', password: 'Password123', firstName: 'New', lastName: 'User',
      });
      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.email).toBe('new@test.com');
    });
  });

  describe('POST /login', () => {
    test('returns 400 if fields are missing', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com' });
      expect(res.status).toBe(400);
    });

    test('returns 401 if user not found', async () => {
      mockModels.User.findOne.mockResolvedValue(null);
      const res = await request(app).post('/api/auth/login').send({
        email: 'nobody@test.com', password: 'Password123',
      });
      expect(res.status).toBe(401);
    });

    test('returns 401 if password is wrong', async () => {
      const hash = await bcrypt.hash('correct', 10);
      mockModels.User.findOne.mockResolvedValue({
        id: 1, email: 'test@test.com', passwordHash: hash, status: 'active',
        update: jest.fn(),
      });
      const res = await request(app).post('/api/auth/login').send({
        email: 'test@test.com', password: 'wrong',
      });
      expect(res.status).toBe(401);
    });

    test('returns 403 if account is suspended', async () => {
      mockModels.User.findOne.mockResolvedValue({
        id: 1, email: 'test@test.com', passwordHash: 'hash', status: 'suspended',
      });
      const res = await request(app).post('/api/auth/login').send({
        email: 'test@test.com', password: 'any',
      });
      expect(res.status).toBe(403);
    });

    test('logs in and returns tokens', async () => {
      const hash = await bcrypt.hash('MyPassword1', 10);
      mockModels.User.findOne.mockResolvedValue({
        id: 1, email: 'test@test.com', firstName: 'Test', lastName: 'User',
        passwordHash: hash, role: 'admin', status: 'active',
        update: jest.fn(),
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'test@test.com', password: 'MyPassword1',
      });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.firstName).toBe('Test');
    });
  });

  describe('POST /refresh', () => {
    test('returns 400 if refreshToken is missing', async () => {
      const res = await request(app).post('/api/auth/refresh').send({});
      expect(res.status).toBe(400);
    });

    test('returns 401 for invalid refresh token', async () => {
      const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'bad' });
      expect(res.status).toBe(401);
    });

    test('returns new access token for valid refresh token', async () => {
      const token = jwt.sign({ id: 1 }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
      mockModels.User.findByPk.mockResolvedValue({ id: 1, email: 'a@b.com', role: 'viewer', status: 'active' });

      const res = await request(app).post('/api/auth/refresh').send({ refreshToken: token });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });
  });

  describe('GET /me (protected)', () => {
    test('returns 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    test('returns user profile with valid token', async () => {
      const user = { id: 1, email: 'test@test.com', firstName: 'Test', lastName: 'User', role: 'admin', status: 'active' };
      mockModels.User.findByPk.mockResolvedValue(user);
      const token = jwt.sign({ id: 1, email: 'test@test.com', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '15m' });

      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('test@test.com');
    });
  });

  describe('PUT /change-password (protected)', () => {
    test('returns 401 without token', async () => {
      const res = await request(app).put('/api/auth/change-password').send({
        currentPassword: 'old', newPassword: 'newpass123',
      });
      expect(res.status).toBe(401);
    });

    test('returns 400 if fields missing', async () => {
      const user = { id: 1, email: 'test@test.com', role: 'admin', status: 'active' };
      mockModels.User.findByPk.mockResolvedValue(user);
      const token = jwt.sign({ id: 1, email: 'test@test.com', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '15m' });

      const res = await request(app).put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'old' });
      expect(res.status).toBe(400);
    });

    test('changes password with valid current password', async () => {
      const hash = await bcrypt.hash('oldpass', 10);
      const user = { id: 1, email: 'test@test.com', role: 'admin', status: 'active', passwordHash: hash, update: jest.fn() };
      // First call: authenticate middleware lookups, second call: authService.changePassword
      mockModels.User.findByPk.mockResolvedValue(user);
      const token = jwt.sign({ id: 1, email: 'test@test.com', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '15m' });

      const res = await request(app).put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'oldpass', newPassword: 'NewPassword123' });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('changed');
    });
  });

  describe('Protected routes require authentication', () => {
    test('GET /api/rfps returns 401 without token', async () => {
      const res = await request(app).get('/api/rfps');
      expect(res.status).toBe(401);
    });

    test('POST /api/vendors returns 401 without token', async () => {
      const res = await request(app).post('/api/vendors').send({ name: 'Test' });
      expect(res.status).toBe(401);
    });

    test('Health check is still public', async () => {
      const res = await request(app).get('/api/health');
      // May be 503 since DB is mocked, but NOT 401
      expect(res.status).not.toBe(401);
    });
  });

  describe('Role-based access', () => {
    test('viewer cannot create RFP (403)', async () => {
      const user = { id: 1, email: 'viewer@test.com', role: 'viewer', status: 'active' };
      mockModels.User.findByPk.mockResolvedValue(user);
      const token = jwt.sign({ id: 1, email: 'viewer@test.com', role: 'viewer' }, process.env.JWT_SECRET, { expiresIn: '15m' });

      const res = await request(app).post('/api/rfps')
        .set('Authorization', `Bearer ${token}`)
        .send({ rawInput: 'test' });
      expect(res.status).toBe(403);
    });

    test('manager can create RFP', async () => {
      const user = { id: 1, email: 'mgr@test.com', role: 'manager', status: 'active' };
      mockModels.User.findByPk.mockResolvedValue(user);
      const token = jwt.sign({ id: 1, email: 'mgr@test.com', role: 'manager' }, process.env.JWT_SECRET, { expiresIn: '15m' });

      // The POST will succeed auth-wise (200 or other non-401/403 status)
      // It may fail on missing AI service mock, but it won't be 401 or 403
      const res = await request(app).post('/api/rfps')
        .set('Authorization', `Bearer ${token}`)
        .send({ rawInput: 'Need laptops' });
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    test('viewer can read RFPs (GET is open to all authenticated)', async () => {
      const user = { id: 1, email: 'viewer@test.com', role: 'viewer', status: 'active' };
      mockModels.User.findByPk.mockResolvedValue(user);
      mockModels.Rfp.findAll.mockResolvedValue([]);
      const token = jwt.sign({ id: 1, email: 'viewer@test.com', role: 'viewer' }, process.env.JWT_SECRET, { expiresIn: '15m' });

      const res = await request(app).get('/api/rfps')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });
});
