/**
 * API endpoint tests for /api/vendors (Phase 1 — Vendor Management).
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
  Vendor: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
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
  User: { findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn(), scope: jest.fn() },
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
jest.mock('../../src/services/embeddingService', () => ({
  indexDocument: jest.fn(),
  getIndexStats: jest.fn(),
}));
jest.mock('../../src/services/searchService', () => ({
  ragSearch: jest.fn(),
}));
jest.mock('../../src/services/complianceService', () => ({
  checkCompliance: jest.fn(),
}));
jest.mock('../../src/services/riskService', () => ({
  analyzeRisks: jest.fn(),
  compareRiskProfiles: jest.fn(),
}));
jest.mock('../../src/services/chatService', () => ({
  chat: jest.fn(),
  generateConversationTitle: jest.fn(),
  getSuggestedQuestions: jest.fn(),
}));

jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 1, email: 'test@test.com', role: 'admin' };
    next();
  },
  requireRole: () => (req, res, next) => next(),
}));

const { createApp } = require('../../src/app');
const { createMockVendor } = require('../helpers/mockFactories');

const app = createApp();

describe('POST /api/vendors', () => {
  beforeEach(() => jest.clearAllMocks());

  test('201 — creates a new vendor', async () => {
    const mockVendor = createMockVendor({ id: 1, name: 'Acme Corp', email: 'acme@test.com', company: 'Acme' });
    mockModels.Vendor.create.mockResolvedValue(mockVendor);

    const res = await request(app)
      .post('/api/vendors')
      .send({ name: 'Acme Corp', email: 'acme@test.com', company: 'Acme' });

    expect(res.status).toBe(201);
    expect(mockModels.Vendor.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Acme Corp', email: 'acme@test.com' })
    );
  });

  test('400 — rejects missing name', async () => {
    const res = await request(app)
      .post('/api/vendors')
      .send({ email: 'test@test.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name' })])
    );
  });

  test('400 — rejects missing email', async () => {
    const res = await request(app)
      .post('/api/vendors')
      .send({ name: 'Test' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/vendors', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — lists all vendors', async () => {
    const vendors = [createMockVendor({ id: 1 }), createMockVendor({ id: 2 })];
    mockModels.Vendor.findAll.mockResolvedValue(vendors);

    const res = await request(app)
      .get('/api/vendors');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('200 — filters by search query', async () => {
    mockModels.Vendor.findAll.mockResolvedValue([]);

    await request(app)
      .get('/api/vendors?search=Acme');

    expect(mockModels.Vendor.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          [Op.or]: expect.any(Array),
        }),
      })
    );
  });

  test('200 — filters by category', async () => {
    mockModels.Vendor.findAll.mockResolvedValue([]);

    await request(app)
      .get('/api/vendors?category=IT');

    expect(mockModels.Vendor.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: 'IT' }),
      })
    );
  });
});

describe('GET /api/vendors/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — returns vendor by id', async () => {
    const vendor = createMockVendor({ id: 1 });
    mockModels.Vendor.findByPk.mockResolvedValue(vendor);

    const res = await request(app)
      .get('/api/vendors/1');

    expect(res.status).toBe(200);
  });

  test('404 — returns error for non-existent vendor', async () => {
    mockModels.Vendor.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/vendors/999');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Vendor not found');
  });
});

describe('PUT /api/vendors/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — updates vendor fields', async () => {
    const vendor = createMockVendor({ id: 1 });
    mockModels.Vendor.findByPk.mockResolvedValue(vendor);

    const res = await request(app)
      .put('/api/vendors/1')
      .send({ name: 'Updated Name', phone: '555-1234' });

    expect(res.status).toBe(200);
    expect(vendor.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Updated Name', phone: '555-1234' })
    );
  });

  test('200 — ignores disallowed fields', async () => {
    const vendor = createMockVendor({ id: 1 });
    mockModels.Vendor.findByPk.mockResolvedValue(vendor);

    await request(app)
      .put('/api/vendors/1')
      .send({ name: 'Updated', id: 999, createdAt: '2020-01-01' });

    const updateCall = vendor.update.mock.calls[0][0];
    expect(updateCall.id).toBeUndefined();
    expect(updateCall.createdAt).toBeUndefined();
  });

  test('404 — returns error for non-existent vendor', async () => {
    mockModels.Vendor.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/vendors/999')
      .send({ name: 'Test' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/vendors/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — deletes a vendor', async () => {
    const vendor = createMockVendor({ id: 1 });
    mockModels.Vendor.findByPk.mockResolvedValue(vendor);

    const res = await request(app)
      .delete('/api/vendors/1');

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');
    expect(vendor.destroy).toHaveBeenCalled();
  });

  test('404 — returns error for non-existent vendor', async () => {
    mockModels.Vendor.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/vendors/999');

    expect(res.status).toBe(404);
  });
});
