/**
 * API endpoint tests for /api/rfps (Phase 1 — RFP Management).
 */

process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'rfp_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'test';

const request = require('supertest');

const mockModels = {
  Rfp: {
    create: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    findByPk: jest.fn(),
  },
  Vendor: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
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

const mockAiService = {
  parseRfpFromNaturalLanguage: jest.fn(),
  parseVendorProposal: jest.fn(),
  compareProposals: jest.fn(),
  extractRequirements: jest.fn(),
  generateProposal: jest.fn(),
};
jest.mock('../../src/services/aiService', () => mockAiService);
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
const { createMockRfp } = require('../helpers/mockFactories');

const app = createApp();

describe('POST /api/rfps', () => {
  beforeEach(() => jest.clearAllMocks());

  test('201 — creates an RFP from natural language input', async () => {
    const parsedData = {
      title: 'Laptop Procurement',
      items: [{ name: 'Laptop', quantity: 100 }],
      budget: { total: 150000, currency: 'USD' },
      timeline: { deliveryDays: 30 },
    };
    mockAiService.parseRfpFromNaturalLanguage.mockResolvedValue(parsedData);

    const mockRfp = createMockRfp({ id: 1, title: 'Laptop Procurement', structuredData: parsedData });
    mockModels.Rfp.create.mockResolvedValue(mockRfp);

    const res = await request(app)
      .post('/api/rfps')
      .send({ rawInput: 'We need 100 laptops with 16GB RAM for our office.' });

    expect(res.status).toBe(201);
    expect(mockAiService.parseRfpFromNaturalLanguage).toHaveBeenCalledWith(
      'We need 100 laptops with 16GB RAM for our office.'
    );
    expect(mockModels.Rfp.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Laptop Procurement',
        rawInput: 'We need 100 laptops with 16GB RAM for our office.',
        status: 'draft',
      })
    );
  });

  test('400 — rejects empty rawInput', async () => {
    const res = await request(app)
      .post('/api/rfps')
      .send({ rawInput: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'rawInput' })])
    );
  });

  test('400 — rejects missing rawInput', async () => {
    const res = await request(app)
      .post('/api/rfps')
      .send({});

    expect(res.status).toBe(400);
  });

  test('400 — rejects rawInput exceeding 10,000 characters', async () => {
    const res = await request(app)
      .post('/api/rfps')
      .send({ rawInput: 'x'.repeat(10001) });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });
});

describe('GET /api/rfps', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — lists all RFPs with associations', async () => {
    mockModels.Rfp.findAndCountAll.mockResolvedValue({ count: 2, rows: [createMockRfp({ id: 1 }), createMockRfp({ id: 2 })] });

    const res = await request(app)
      .get('/api/rfps');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
  });
});

describe('GET /api/rfps/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — returns RFP with vendors, proposals, comparisons', async () => {
    const mockRfp = createMockRfp({ id: 1, vendors: [], proposals: [], comparisons: [] });
    mockModels.Rfp.findByPk.mockResolvedValue(mockRfp);

    const res = await request(app)
      .get('/api/rfps/1');

    expect(res.status).toBe(200);
  });

  test('404 — returns error for non-existent RFP', async () => {
    mockModels.Rfp.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/rfps/999');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('RFP not found');
  });
});

describe('PUT /api/rfps/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — updates allowed fields', async () => {
    const mockRfp = createMockRfp({ id: 1 });
    mockModels.Rfp.findByPk.mockResolvedValue(mockRfp);

    const res = await request(app)
      .put('/api/rfps/1')
      .send({ title: 'Updated Title', budget: 200000, status: 'published' });

    expect(res.status).toBe(200);
    expect(mockRfp.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Updated Title', budget: 200000, status: 'published' })
    );
  });

  test('200 — ignores disallowed fields (rawInput, id)', async () => {
    const mockRfp = createMockRfp({ id: 1 });
    mockModels.Rfp.findByPk.mockResolvedValue(mockRfp);

    await request(app)
      .put('/api/rfps/1')
      .send({ title: 'Updated', rawInput: 'hacked', id: 999 });

    const updateCall = mockRfp.update.mock.calls[0][0];
    expect(updateCall.rawInput).toBeUndefined();
    expect(updateCall.id).toBeUndefined();
  });

  test('404 — returns error for non-existent RFP', async () => {
    mockModels.Rfp.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/rfps/999')
      .send({ title: 'test' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/rfps/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — deletes an RFP', async () => {
    const mockRfp = createMockRfp({ id: 1 });
    mockModels.Rfp.findByPk.mockResolvedValue(mockRfp);

    const res = await request(app)
      .delete('/api/rfps/1');

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');
    expect(mockRfp.destroy).toHaveBeenCalled();
  });

  test('404 — returns error for non-existent RFP', async () => {
    mockModels.Rfp.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/rfps/999');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/rfps/:id/send', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 — rejects when vendorIds is empty', async () => {
    const mockRfp = createMockRfp({ id: 1 });
    mockModels.Rfp.findByPk.mockResolvedValue(mockRfp);

    const res = await request(app)
      .post('/api/rfps/1/send')
      .send({ vendorIds: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'vendorIds' })])
    );
  });

  test('400 — rejects non-integer vendorIds', async () => {
    const mockRfp = createMockRfp({ id: 1 });
    mockModels.Rfp.findByPk.mockResolvedValue(mockRfp);

    const res = await request(app)
      .post('/api/rfps/1/send')
      .send({ vendorIds: ['abc'] });

    expect(res.status).toBe(400);
  });

  test('404 — returns error when RFP not found', async () => {
    mockModels.Rfp.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/rfps/999/send')
      .send({ vendorIds: [1, 2] });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/rfps/:id/compare', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 — rejects when fewer than 2 parsed proposals', async () => {
    const mockRfp = createMockRfp({ id: 1, proposals: [] });
    mockModels.Rfp.findByPk.mockResolvedValue(mockRfp);

    const res = await request(app)
      .post('/api/rfps/1/compare');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('at least 2');
  });

  test('404 — returns error when RFP not found', async () => {
    mockModels.Rfp.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/rfps/999/compare');

    expect(res.status).toBe(404);
  });
});
