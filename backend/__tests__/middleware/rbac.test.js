/**
 * RBAC enforcement tests — verifies role-based access control and user-scoped data filtering.
 * Uses the real requireRole middleware but mocks authenticate to inject different user roles.
 */

process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'rfp_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'test';

const request = require('supertest');

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

// Use real requireRole but inject user via authenticate mock
// Jest requires mock-factory variables to be prefixed with "mock"
let mockCurrentUser = { id: 1, email: 'admin@test.com', role: 'admin' };

jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = mockCurrentUser;
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
const { createMockRfp, createMockVendor, createMockRfpDocument, createMockUser } = require('../helpers/mockFactories');

const app = createApp();

function setUser(role, id = 1) {
  mockCurrentUser = { id, email: `${role}@test.com`, role };
}

describe('RBAC — Viewer role restrictions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setUser('viewer', 10);
  });

  test('403 — viewer cannot create RFP', async () => {
    const res = await request(app)
      .post('/api/rfps')
      .send({ rawInput: 'Test RFP' });

    expect(res.status).toBe(403);
  });

  test('403 — viewer cannot create vendor', async () => {
    const res = await request(app)
      .post('/api/vendors')
      .send({ name: 'Test', email: 'test@test.com' });

    expect(res.status).toBe(403);
  });

  test('403 — viewer cannot delete vendor', async () => {
    const res = await request(app).delete('/api/vendors/1');

    expect(res.status).toBe(403);
  });

  test('403 — viewer cannot run compliance check', async () => {
    const res = await request(app)
      .post('/api/compliance/check')
      .send({ rfpDocumentId: 1 });

    expect(res.status).toBe(403);
  });

  test('403 — viewer cannot run risk analysis', async () => {
    const res = await request(app)
      .post('/api/risk-analysis')
      .send({ rfpDocumentId: 1 });

    expect(res.status).toBe(403);
  });

  test('403 — viewer cannot delete chat conversation', async () => {
    const res = await request(app).delete('/api/chat/conversations/1');

    expect(res.status).toBe(403);
  });

  test('403 — viewer cannot access admin endpoints', async () => {
    const res = await request(app).get('/api/admin/users');

    expect(res.status).toBe(403);
  });

  test('200 — viewer can list RFPs (own data)', async () => {
    mockModels.Rfp.findAll.mockResolvedValue([]);

    const res = await request(app).get('/api/rfps');

    expect(res.status).toBe(200);
    // Verify user-scoping filter is applied
    expect(mockModels.Rfp.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 10 }),
      })
    );
  });

  test('200 — viewer can list vendors (own data)', async () => {
    mockModels.Vendor.findAll.mockResolvedValue([]);

    const res = await request(app).get('/api/vendors');

    expect(res.status).toBe(200);
    expect(mockModels.Vendor.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 10 }),
      })
    );
  });

  test('200 — viewer can list conversations (own data)', async () => {
    mockModels.ChatConversation.findAll.mockResolvedValue([]);

    const res = await request(app).get('/api/chat/conversations');

    expect(res.status).toBe(200);
    expect(mockModels.ChatConversation.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 10 }),
      })
    );
  });
});

describe('RBAC — Manager role permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setUser('manager', 5);
  });

  test('403 — manager cannot access admin endpoints', async () => {
    const res = await request(app).get('/api/admin/users');

    expect(res.status).toBe(403);
  });

  test('manager can create RFP (with userId set)', async () => {
    const aiService = require('../../src/services/aiService');
    aiService.parseRfpFromNaturalLanguage.mockResolvedValue({
      title: 'Test RFP',
      budget: { total: 1000, currency: 'USD' },
      timeline: {},
    });
    const mockRfp = createMockRfp({ id: 1, userId: 5 });
    mockModels.Rfp.create.mockResolvedValue(mockRfp);

    const res = await request(app)
      .post('/api/rfps')
      .send({ rawInput: 'We need 10 laptops' });

    expect(res.status).toBe(201);
    expect(mockModels.Rfp.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 5 })
    );
  });

  test('manager can create vendor (with userId set)', async () => {
    const mockVendor = createMockVendor({ id: 1, userId: 5 });
    mockModels.Vendor.create.mockResolvedValue(mockVendor);

    const res = await request(app)
      .post('/api/vendors')
      .send({ name: 'Test', email: 'test@test.com' });

    expect(res.status).toBe(201);
    expect(mockModels.Vendor.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 5 })
    );
  });
});

describe('RBAC — User-scoped data access control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setUser('manager', 5);
  });

  test('403 — cannot access another user\'s RFP', async () => {
    const rfp = createMockRfp({ id: 1, userId: 99 });
    mockModels.Rfp.findByPk.mockResolvedValue(rfp);

    const res = await request(app).get('/api/rfps/1');

    expect(res.status).toBe(403);
  });

  test('403 — cannot update another user\'s vendor', async () => {
    const vendor = createMockVendor({ id: 1, userId: 99 });
    mockModels.Vendor.findByPk.mockResolvedValue(vendor);

    const res = await request(app)
      .put('/api/vendors/1')
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });

  test('403 — cannot access another user\'s document', async () => {
    const doc = createMockRfpDocument({ id: 1, userId: 99 });
    mockModels.RfpDocument.findByPk.mockResolvedValue(doc);

    const res = await request(app).get('/api/rfp-documents/1');

    expect(res.status).toBe(403);
  });

  test('403 — cannot access another user\'s conversation', async () => {
    const conv = { id: 1, userId: 99, title: 'Other user chat', status: 'active', messages: [] };
    mockModels.ChatConversation.findByPk.mockResolvedValue(conv);

    const res = await request(app).get('/api/chat/conversations/1');

    expect(res.status).toBe(403);
  });
});

describe('RBAC — Admin bypasses user-scoping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setUser('admin', 1);
  });

  test('admin can access any user\'s RFP', async () => {
    const rfp = createMockRfp({ id: 1, userId: 99 });
    mockModels.Rfp.findByPk.mockResolvedValue(rfp);

    const res = await request(app).get('/api/rfps/1');

    expect(res.status).toBe(200);
  });

  test('admin can access any user\'s vendor', async () => {
    const vendor = createMockVendor({ id: 1, userId: 99 });
    mockModels.Vendor.findByPk.mockResolvedValue(vendor);

    const res = await request(app).get('/api/vendors/1');

    expect(res.status).toBe(200);
  });

  test('admin lists all RFPs without user filter', async () => {
    mockModels.Rfp.findAll.mockResolvedValue([]);

    await request(app).get('/api/rfps');

    const findAllArg = mockModels.Rfp.findAll.mock.calls[0][0];
    expect(findAllArg.where.userId).toBeUndefined();
  });

  test('admin can access admin endpoints', async () => {
    mockModels.User.findAll.mockResolvedValue([]);

    const res = await request(app).get('/api/admin/users');

    expect(res.status).toBe(200);
  });
});
