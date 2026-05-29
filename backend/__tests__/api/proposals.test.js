/**
 * API endpoint tests for /api/proposals (Phase 1 — Proposal Management).
 */

process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'rfp_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'test';

const request = require('supertest');

const mockModels = {
  Rfp: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  Vendor: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn(), findOne: jest.fn() },
  RfpVendor: { findOrCreate: jest.fn(), findOne: jest.fn() },
  Proposal: {
    create: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    findByPk: jest.fn(),
    update: jest.fn(),
  },
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
jest.mock('../../src/services/searchService', () => ({ ragSearch: jest.fn() }));
jest.mock('../../src/services/complianceService', () => ({ checkCompliance: jest.fn() }));
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
const { createMockRfp, createMockVendor, createMockProposal } = require('../helpers/mockFactories');

const app = createApp();

describe('POST /api/proposals/manual', () => {
  beforeEach(() => jest.clearAllMocks());

  test('201 — creates a manual proposal', async () => {
    const mockRfp = createMockRfp({ id: 1 });
    const mockVendor = createMockVendor({ id: 1 });
    mockModels.Rfp.findByPk.mockResolvedValue(mockRfp);
    mockModels.Vendor.findByPk.mockResolvedValue(mockVendor);

    const mockProposal = createMockProposal({ id: 1, rfpId: 1, vendorId: 1 });
    mockModels.Proposal.create.mockResolvedValue(mockProposal);

    const res = await request(app)
      .post('/api/proposals/manual')
      .send({ rfpId: 1, vendorId: 1, rawContent: 'Our proposal for laptops...' });

    expect(res.status).toBe(201);
    expect(mockModels.Proposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        rfpId: 1,
        vendorId: 1,
        rawContent: 'Our proposal for laptops...',
        sourceType: 'manual',
        status: 'received',
      })
    );
  });

  test('404 — rejects when RFP not found', async () => {
    mockModels.Rfp.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/proposals/manual')
      .send({ rfpId: 999, vendorId: 1, rawContent: 'text' });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('RFP not found');
  });

  test('404 — rejects when Vendor not found', async () => {
    mockModels.Rfp.findByPk.mockResolvedValue(createMockRfp({ id: 1 }));
    mockModels.Vendor.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/proposals/manual')
      .send({ rfpId: 1, vendorId: 999, rawContent: 'text' });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Vendor not found');
  });
});

describe('POST /api/proposals/:id/parse', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — AI-parses a proposal', async () => {
    const mockRfp = createMockRfp({ id: 1 });
    const mockVendor = createMockVendor({ id: 1 });
    const mockProposal = createMockProposal({
      id: 1,
      rfpId: 1,
      vendorId: 1,
      rawContent: 'We offer 100 laptops at $1200 each.',
      rfp: { ...mockRfp, structuredData: mockRfp.structuredData },
      vendor: mockVendor,
      attachments: null,
    });
    mockModels.Proposal.findByPk.mockResolvedValue(mockProposal);

    const parsedData = {
      vendorName: 'Dell',
      totalPrice: 120000,
      lineItems: [{ itemName: 'Laptop', quantity: 100, unitPrice: 1200 }],
    };
    mockAiService.parseVendorProposal.mockResolvedValue(parsedData);

    const res = await request(app)
      .post('/api/proposals/1/parse');

    expect(res.status).toBe(200);
    expect(mockProposal.update).toHaveBeenCalledWith({ status: 'parsing' });
    expect(mockAiService.parseVendorProposal).toHaveBeenCalled();
    expect(mockProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedData,
        totalPrice: 120000,
        status: 'parsed',
      })
    );
  });

  test('404 — returns error for non-existent proposal', async () => {
    mockModels.Proposal.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/proposals/999/parse');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Proposal not found');
  });

  test('400 — rejects proposal with no content to parse', async () => {
    const mockProposal = createMockProposal({
      id: 1,
      rawContent: '',
      attachments: null,
      rfp: createMockRfp({ id: 1 }),
      vendor: createMockVendor({ id: 1 }),
    });
    mockModels.Proposal.findByPk.mockResolvedValue(mockProposal);

    const res = await request(app)
      .post('/api/proposals/1/parse');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('No content to parse');
  });
});

describe('GET /api/proposals', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — lists all proposals', async () => {
    mockModels.Proposal.findAndCountAll.mockResolvedValue({
      count: 2,
      rows: [createMockProposal({ id: 1 }), createMockProposal({ id: 2 })],
    });

    const res = await request(app)
      .get('/api/proposals');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
  });

  test('200 — filters by rfpId', async () => {
    mockModels.Proposal.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await request(app)
      .get('/api/proposals?rfpId=5');

    expect(mockModels.Proposal.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { rfpId: 5 },
      })
    );
  });

  test('400 — rejects invalid rfpId', async () => {
    const res = await request(app)
      .get('/api/proposals?rfpId=abc');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid rfpId');
  });

  test('400 — rejects rfpId of 0', async () => {
    const res = await request(app)
      .get('/api/proposals?rfpId=0');

    expect(res.status).toBe(400);
  });
});

describe('GET /api/proposals/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — returns proposal with vendor and RFP', async () => {
    const proposal = createMockProposal({
      id: 1,
      rfp: createMockRfp({ id: 1 }),
      vendor: createMockVendor({ id: 1 }),
    });
    mockModels.Proposal.findByPk.mockResolvedValue(proposal);

    const res = await request(app)
      .get('/api/proposals/1');

    expect(res.status).toBe(200);
  });

  test('404 — returns error for non-existent proposal', async () => {
    mockModels.Proposal.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/proposals/999');

    expect(res.status).toBe(404);
  });
});
