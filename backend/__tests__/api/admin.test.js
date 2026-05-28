/**
 * API endpoint tests for /api/admin (User Management — Admin only).
 */

process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'rfp_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'test';

const request = require('supertest');
const { Op } = require('sequelize');

const mockModels = {
  Vendor: { create: jest.fn(), findAll: jest.fn(), findByPk: jest.fn(), findOne: jest.fn() },
  Rfp: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  RfpVendor: { findOrCreate: jest.fn() },
  Proposal: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn(), update: jest.fn() },
  Comparison: { create: jest.fn() },
  RfpDocument: { findByPk: jest.fn(), findAll: jest.fn(), create: jest.fn() },
  GeneratedProposal: { findByPk: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), create: jest.fn(), count: jest.fn(), destroy: jest.fn() },
  DocumentEmbedding: {},
  RiskAnalysis: { create: jest.fn(), findByPk: jest.fn(), findAll: jest.fn() },
  ChatConversation: { create: jest.fn(), findByPk: jest.fn(), findAll: jest.fn(), update: jest.fn() },
  ChatMessage: { create: jest.fn(), findAll: jest.fn(), count: jest.fn(), destroy: jest.fn() },
  User: { findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn(), findAll: jest.fn(), scope: jest.fn() },
  sequelize: { authenticate: jest.fn(), sync: jest.fn(), close: jest.fn() },
};
jest.mock('../../src/models', () => mockModels);
jest.mock('../../src/config/database', () => ({}));
jest.mock('../../src/services/aiService', () => ({
  parseRfpFromNaturalLanguage: jest.fn(),
  parseVendorProposal: jest.fn(),
  compareProposals: jest.fn(),
  extractRequirements: jest.fn(),
  generateProposal: jest.fn(),
}));
jest.mock('../../src/services/emailService', () => ({
  sendRfpEmail: jest.fn(),
  fetchInboundEmails: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../src/services/embeddingService', () => ({ indexDocument: jest.fn(), getIndexStats: jest.fn() }));
jest.mock('../../src/services/searchService', () => ({ ragSearch: jest.fn() }));
jest.mock('../../src/services/complianceService', () => ({ checkCompliance: jest.fn() }));
jest.mock('../../src/services/riskService', () => ({ analyzeRisks: jest.fn(), compareRiskProfiles: jest.fn() }));
jest.mock('../../src/services/chatService', () => ({ chat: jest.fn(), generateConversationTitle: jest.fn(), getSuggestedQuestions: jest.fn() }));

jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 1, email: 'admin@test.com', role: 'admin' };
    next();
  },
  requireRole: (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  },
}));

const { createApp } = require('../../src/app');
const { createMockUser } = require('../helpers/mockFactories');

const app = createApp();

describe('GET /api/admin/users', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — lists all users', async () => {
    const users = [
      createMockUser({ id: 1, role: 'admin' }),
      createMockUser({ id: 2, role: 'manager' }),
      createMockUser({ id: 3, role: 'viewer' }),
    ];
    mockModels.User.findAll.mockResolvedValue(users);

    const res = await request(app).get('/api/admin/users');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  test('200 — filters by role', async () => {
    mockModels.User.findAll.mockResolvedValue([]);

    await request(app).get('/api/admin/users?role=manager');

    expect(mockModels.User.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: 'manager' }),
      })
    );
  });

  test('200 — filters by search', async () => {
    mockModels.User.findAll.mockResolvedValue([]);

    await request(app).get('/api/admin/users?search=john');

    expect(mockModels.User.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          [Op.or]: expect.any(Array),
        }),
      })
    );
  });
});

describe('GET /api/admin/users/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — returns a user', async () => {
    const user = createMockUser({ id: 2 });
    mockModels.User.findByPk.mockResolvedValue(user);

    const res = await request(app).get('/api/admin/users/2');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(2);
  });

  test('404 — user not found', async () => {
    mockModels.User.findByPk.mockResolvedValue(null);

    const res = await request(app).get('/api/admin/users/999');

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/admin/users/:id/role', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — changes user role', async () => {
    const user = createMockUser({ id: 2, role: 'viewer' });
    mockModels.User.findByPk.mockResolvedValue(user);

    const res = await request(app)
      .put('/api/admin/users/2/role')
      .send({ role: 'manager' });

    expect(res.status).toBe(200);
    expect(user.update).toHaveBeenCalledWith({ role: 'manager' });
  });

  test('400 — rejects invalid role', async () => {
    const res = await request(app)
      .put('/api/admin/users/2/role')
      .send({ role: 'superadmin' });

    expect(res.status).toBe(400);
  });

  test('400 — prevents changing own role', async () => {
    const user = createMockUser({ id: 1, role: 'admin' });
    mockModels.User.findByPk.mockResolvedValue(user);

    const res = await request(app)
      .put('/api/admin/users/1/role')
      .send({ role: 'viewer' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('own role');
  });

  test('404 — user not found', async () => {
    mockModels.User.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/admin/users/999/role')
      .send({ role: 'manager' });

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/admin/users/:id/status', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — suspends a user', async () => {
    const user = createMockUser({ id: 2, status: 'active' });
    mockModels.User.findByPk.mockResolvedValue(user);

    const res = await request(app)
      .put('/api/admin/users/2/status')
      .send({ status: 'suspended' });

    expect(res.status).toBe(200);
    expect(user.update).toHaveBeenCalledWith({ status: 'suspended' });
  });

  test('200 — reactivates a user', async () => {
    const user = createMockUser({ id: 2, status: 'suspended' });
    mockModels.User.findByPk.mockResolvedValue(user);

    const res = await request(app)
      .put('/api/admin/users/2/status')
      .send({ status: 'active' });

    expect(res.status).toBe(200);
    expect(user.update).toHaveBeenCalledWith({ status: 'active' });
  });

  test('400 — rejects invalid status', async () => {
    const res = await request(app)
      .put('/api/admin/users/2/status')
      .send({ status: 'deleted' });

    expect(res.status).toBe(400);
  });

  test('400 — prevents changing own status', async () => {
    const user = createMockUser({ id: 1 });
    mockModels.User.findByPk.mockResolvedValue(user);

    const res = await request(app)
      .put('/api/admin/users/1/status')
      .send({ status: 'suspended' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('own status');
  });
});
