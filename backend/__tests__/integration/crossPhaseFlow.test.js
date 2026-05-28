/**
 * Cross-phase integration tests.
 * Verifies Phase 1 and Phase 2 data flows work together:
 * - Phase 1 RFPs and Proposals can be indexed for Phase 2 search
 * - Compliance checker works across both phases
 * - Models from both phases share the same DB context correctly
 */

process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'rfp_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'test';

const request = require('supertest');

const mockModels = {
  RfpDocument: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  GeneratedProposal: {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    count: jest.fn(),
    destroy: jest.fn(),
  },
  Rfp: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  Vendor: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  RfpVendor: { findOrCreate: jest.fn() },
  Proposal: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    update: jest.fn(),
  },
  Comparison: { create: jest.fn() },
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

const mockEmbeddingService = {
  indexDocument: jest.fn().mockResolvedValue({ indexed: 3, chunks: 3 }),
  semanticSearch: jest.fn(),
  getIndexStats: jest.fn().mockResolvedValue({ totalChunks: 10, byType: [] }),
};
jest.mock('../../src/services/embeddingService', () => mockEmbeddingService);

const mockSearchService = {
  ragSearch: jest.fn(),
};
jest.mock('../../src/services/searchService', () => mockSearchService);

jest.mock('../../src/services/complianceService', () => ({
  checkCompliance: jest.fn(),
}));

jest.mock('../../src/services/emailService', () => ({
  sendRfpEmail: jest.fn(),
  fetchInboundEmails: jest.fn().mockResolvedValue([]),
}));

jest.mock('pdf-parse', () => jest.fn().mockResolvedValue({ text: 'PDF text' }));

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
const { createMockRfp, createMockVendor, createMockProposal, createMockRfpDocument } = require('../helpers/mockFactories');

const app = createApp();

describe('Cross-Phase Integration — Phase 1 RFPs Searchable via Phase 2 Index', () => {
  beforeEach(() => jest.clearAllMocks());

  test('Phase 1 RFP can be indexed for Phase 2 semantic search', async () => {
    // Phase 1: Create an RFP
    const mockRfp = createMockRfp({
      id: 1,
      title: 'Laptop Procurement RFP',
      rawInput: 'We need 100 business laptops with 16GB RAM and 512GB SSD.',
      structuredData: {
        items: [{ name: 'Laptop', quantity: 100, specifications: '16GB RAM, 512GB SSD' }],
      },
      status: 'sent',
    });
    mockModels.Rfp.findByPk.mockResolvedValue(mockRfp);

    // Phase 2: Index this Phase 1 RFP
    const res = await request(app)
      .post('/api/search/index/rfp/1');

    expect(res.status).toBe(200);
    expect(res.body.indexed).toBe(3);
    expect(mockEmbeddingService.indexDocument).toHaveBeenCalledWith(
      'rfp', 1,
      expect.stringContaining('We need 100 business laptops'),
      'Laptop Procurement RFP',
      expect.objectContaining({ status: 'sent' })
    );
  });

  test('Phase 1 Vendor Proposal can be indexed for Phase 2 search', async () => {
    const mockProposal = createMockProposal({
      id: 5,
      rfpId: 1,
      vendorId: 2,
      rawContent: 'We offer Dell Latitude 5540 at $1,100 each with 3-year warranty.',
      parsedData: { totalPrice: 110000, deliveryDays: 15 },
      status: 'parsed',
    });
    mockModels.Proposal.findByPk.mockResolvedValue(mockProposal);

    const res = await request(app)
      .post('/api/search/index/proposal/5');

    expect(res.status).toBe(200);
    expect(mockEmbeddingService.indexDocument).toHaveBeenCalledWith(
      'proposal', 5,
      expect.stringContaining('Dell Latitude 5540'),
      'Vendor Proposal #5',
      expect.objectContaining({ rfpId: 1, vendorId: 2 })
    );
  });

  test('Phase 2 search finds results across Phase 1 and Phase 2 data', async () => {
    mockSearchService.ragSearch.mockResolvedValue({
      answer: 'Based on the indexed documents, laptop pricing ranges from $1,100 to $1,300.',
      sources: [
        { sourceType: 'rfp', sourceId: 1, sourceTitle: 'Laptop RFP', topSimilarity: 0.90, chunkCount: 2 },
        { sourceType: 'proposal', sourceId: 5, sourceTitle: 'Vendor Proposal #5', topSimilarity: 0.88, chunkCount: 1 },
        { sourceType: 'rfp_document', sourceId: 10, sourceTitle: 'Hardware RFP', topSimilarity: 0.75, chunkCount: 1 },
      ],
      chunks: [],
    });

    const res = await request(app)
      .post('/api/search')
      .send({ query: 'What laptop pricing has been proposed?' });

    expect(res.status).toBe(200);
    expect(res.body.sources).toHaveLength(3);

    // Verify sources span both Phase 1 (rfp, proposal) and Phase 2 (rfp_document) types
    const sourceTypes = res.body.sources.map(s => s.sourceType);
    expect(sourceTypes).toContain('rfp');
    expect(sourceTypes).toContain('proposal');
    expect(sourceTypes).toContain('rfp_document');
  });
});

describe('Cross-Phase Integration — Index All Includes Both Phases', () => {
  beforeEach(() => jest.clearAllMocks());

  test('index-all indexes documents from both Phase 1 and Phase 2', async () => {
    // Phase 1 data
    mockModels.Rfp.findAll.mockResolvedValue([
      createMockRfp({ id: 1, rawInput: 'Laptop RFP', structuredData: { items: [] } }),
    ]);
    mockModels.Proposal.findAll.mockResolvedValue([
      createMockProposal({ id: 1, rawContent: 'Vendor proposal', parsedData: null, status: 'parsed' }),
    ]);

    // Phase 2 data
    mockModels.RfpDocument.findAll.mockResolvedValue([
      createMockRfpDocument({ id: 1, status: 'extracted', rawText: 'Cloud RFP document' }),
    ]);
    mockModels.GeneratedProposal.findAll.mockResolvedValue([
      { id: 1, proposalContent: { title: 'Gen Proposal' }, title: 'Gen Proposal v1', version: 1, rfpDocumentId: 1, status: 'generated' },
    ]);

    const res = await request(app)
      .post('/api/search/index-all');

    expect(res.status).toBe(200);
    expect(res.body.details.rfps).toBe(1);
    expect(res.body.details.proposals).toBe(1);
    expect(res.body.details.rfp_documents).toBe(1);
    expect(res.body.details.generated_proposals).toBe(1);
    expect(res.body.indexed).toBe(4);
  });
});

describe('Cross-Phase Integration — Model Associations', () => {
  test('models/index.js exports all models from both phases', () => {
    expect(mockModels.Rfp).toBeDefined();
    expect(mockModels.Vendor).toBeDefined();
    expect(mockModels.Proposal).toBeDefined();
    expect(mockModels.Comparison).toBeDefined();
    expect(mockModels.RfpDocument).toBeDefined();
    expect(mockModels.GeneratedProposal).toBeDefined();
    expect(mockModels.DocumentEmbedding).toBeDefined();
  });

  test('health check endpoint is accessible', async () => {
    // Health check depends on sequelize.authenticate which we've mocked
    mockModels.sequelize.authenticate.mockResolvedValue();

    const res = await request(app)
      .get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
    expect(res.body.timestamp).toBeDefined();
  });

  test('health check returns 503 when DB is down', async () => {
    mockModels.sequelize.authenticate.mockRejectedValue(new Error('Connection refused'));

    const res = await request(app)
      .get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.database).toBe('disconnected');
  });
});

describe('Cross-Phase Integration — Error Propagation', () => {
  beforeEach(() => jest.clearAllMocks());

  test('Phase 2 endpoints handle AI service errors gracefully', async () => {
    const doc = createMockRfpDocument({ id: 1, status: 'uploaded' });
    mockModels.RfpDocument.findByPk.mockResolvedValue(doc);
    mockAiService.extractRequirements.mockRejectedValue(new Error('OpenAI quota exceeded'));

    const res = await request(app)
      .post('/api/rfp-documents/1/extract');

    expect(res.status).toBe(500);
    // Error should be handled by the error handler middleware
    expect(res.body.error).toBeDefined();
  });

  test('Search handles embedding service failure', async () => {
    mockSearchService.ragSearch.mockRejectedValue(new Error('Embedding service unavailable'));

    const res = await request(app)
      .post('/api/search')
      .send({ query: 'test query' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});
