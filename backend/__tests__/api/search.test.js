/**
 * API endpoint tests for /api/search (Phase 2 — Semantic Search).
 */

process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'rfp_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'test';

const request = require('supertest');

// Mock models
const mockModels = {
  RfpDocument: { findByPk: jest.fn(), findAll: jest.fn() },
  GeneratedProposal: { findByPk: jest.fn(), findAll: jest.fn() },
  Proposal: { findByPk: jest.fn(), findAll: jest.fn() },
  Rfp: { findByPk: jest.fn(), findAll: jest.fn() },
  Vendor: { findAll: jest.fn(), findByPk: jest.fn() },
  RfpVendor: {},
  Comparison: {},
  DocumentEmbedding: {},
  RiskAnalysis: { create: jest.fn(), findByPk: jest.fn(), findAll: jest.fn() },
  ChatConversation: { create: jest.fn(), findByPk: jest.fn(), findAll: jest.fn(), update: jest.fn() },
  ChatMessage: { create: jest.fn(), findAll: jest.fn(), count: jest.fn(), destroy: jest.fn() },
  User: { findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn(), scope: jest.fn() },
  sequelize: { authenticate: jest.fn(), sync: jest.fn(), close: jest.fn() },
};
jest.mock('../../src/models', () => mockModels);
jest.mock('../../src/config/database', () => ({}));

// Mock services
const mockEmbeddingService = {
  indexDocument: jest.fn(),
  semanticSearch: jest.fn(),
  getIndexStats: jest.fn(),
};
const mockSearchService = {
  ragSearch: jest.fn(),
};
jest.mock('../../src/services/embeddingService', () => mockEmbeddingService);
jest.mock('../../src/services/searchService', () => mockSearchService);
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
const { createMockRfpDocument, createMockGeneratedProposal } = require('../helpers/mockFactories');

const app = createApp();

describe('POST /api/search', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — performs RAG search and returns answer with sources', async () => {
    mockSearchService.ragSearch.mockResolvedValue({
      answer: 'The RFP requires OAuth 2.0 authentication.',
      sources: [{ sourceType: 'rfp_document', sourceId: 1, sourceTitle: 'Test RFP', topSimilarity: 0.92, chunkCount: 2 }],
      chunks: [{ sourceTitle: 'Test RFP', chunkText: 'OAuth 2.0 required.', similarity: 0.92 }],
    });

    const res = await request(app)
      .post('/api/search')
      .send({ query: 'What authentication is required?' });

    expect(res.status).toBe(200);
    expect(res.body.answer).toContain('OAuth 2.0');
    expect(res.body.sources).toHaveLength(1);
    expect(res.body.chunks).toHaveLength(1);
    expect(mockSearchService.ragSearch).toHaveBeenCalledWith('What authentication is required?', {
      topK: 8,
      filterSourceType: null,
    });
  });

  test('200 — respects topK and filterSourceType options', async () => {
    mockSearchService.ragSearch.mockResolvedValue({ answer: '', sources: [], chunks: [] });

    await request(app)
      .post('/api/search')
      .send({ query: 'test', topK: 5, filterSourceType: 'generated_proposal' });

    expect(mockSearchService.ragSearch).toHaveBeenCalledWith('test', {
      topK: 5,
      filterSourceType: 'generated_proposal',
    });
  });

  test('400 — rejects empty query', async () => {
    const res = await request(app)
      .post('/api/search')
      .send({ query: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'query' })])
    );
  });

  test('400 — rejects missing query', async () => {
    const res = await request(app)
      .post('/api/search')
      .send({});

    expect(res.status).toBe(400);
  });

  test('400 — rejects whitespace-only query', async () => {
    const res = await request(app)
      .post('/api/search')
      .send({ query: '   ' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/search/index/:sourceType/:sourceId', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — indexes an rfp_document', async () => {
    const mockDoc = createMockRfpDocument({ id: 1, title: 'Test RFP', rawText: 'Full document text' });
    mockModels.RfpDocument.findByPk.mockResolvedValue(mockDoc);
    mockEmbeddingService.indexDocument.mockResolvedValue({ indexed: 3, chunks: 3 });

    const res = await request(app)
      .post('/api/search/index/rfp_document/1');

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('indexed');
    expect(res.body.indexed).toBe(3);
    expect(mockEmbeddingService.indexDocument).toHaveBeenCalledWith(
      'rfp_document', 1, 'Full document text', 'Test RFP', expect.any(Object)
    );
  });

  test('200 — indexes a generated_proposal', async () => {
    const mockProposal = createMockGeneratedProposal({
      id: 5,
      rfpDocument: createMockRfpDocument({ id: 1 }),
    });
    mockModels.GeneratedProposal.findByPk.mockResolvedValue(mockProposal);
    mockEmbeddingService.indexDocument.mockResolvedValue({ indexed: 5, chunks: 5 });

    const res = await request(app)
      .post('/api/search/index/generated_proposal/5');

    expect(res.status).toBe(200);
    expect(res.body.indexed).toBe(5);
  });

  test('404 — returns error for non-existent document', async () => {
    mockModels.RfpDocument.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/search/index/rfp_document/999');

    expect(res.status).toBe(404);
  });

  test('400 — rejects invalid sourceType', async () => {
    const res = await request(app)
      .post('/api/search/index/invalid_type/1');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid sourceType');
  });

  test('200 — indexes a proposal (Phase 1 model)', async () => {
    mockModels.Proposal.findByPk.mockResolvedValue({
      id: 3,
      rawContent: 'Vendor proposal text',
      parsedData: { totalPrice: 100000 },
      rfpId: 1,
      vendorId: 2,
    });
    mockEmbeddingService.indexDocument.mockResolvedValue({ indexed: 2, chunks: 2 });

    const res = await request(app)
      .post('/api/search/index/proposal/3');

    expect(res.status).toBe(200);
    expect(res.body.indexed).toBe(2);
  });

  test('200 — indexes an rfp (Phase 1 model)', async () => {
    mockModels.Rfp.findByPk.mockResolvedValue({
      id: 1,
      title: 'Laptop RFP',
      rawInput: 'Need 100 laptops',
      structuredData: { items: [] },
      status: 'draft',
    });
    mockEmbeddingService.indexDocument.mockResolvedValue({ indexed: 1, chunks: 1 });

    const res = await request(app)
      .post('/api/search/index/rfp/1');

    expect(res.status).toBe(200);
  });
});

describe('POST /api/search/index-all', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — indexes all documents across all types', async () => {
    mockModels.RfpDocument.findAll.mockResolvedValue([
      createMockRfpDocument({ id: 1, status: 'extracted' }),
    ]);
    mockModels.GeneratedProposal.findAll.mockResolvedValue([
      createMockGeneratedProposal({ id: 1, status: 'generated' }),
    ]);
    mockModels.Proposal.findAll.mockResolvedValue([]);
    mockModels.Rfp.findAll.mockResolvedValue([]);
    mockEmbeddingService.indexDocument.mockResolvedValue({ indexed: 3 });

    const res = await request(app)
      .post('/api/search/index-all');

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Indexing complete');
    expect(res.body.indexed).toBe(2); // 1 rfp_document + 1 generated_proposal
    expect(res.body.details.rfp_documents).toBe(1);
    expect(res.body.details.generated_proposals).toBe(1);
  });

  test('200 — handles partial failures gracefully', async () => {
    mockModels.RfpDocument.findAll.mockResolvedValue([
      createMockRfpDocument({ id: 1, status: 'extracted' }),
    ]);
    mockModels.GeneratedProposal.findAll.mockResolvedValue([]);
    mockModels.Proposal.findAll.mockResolvedValue([]);
    mockModels.Rfp.findAll.mockResolvedValue([]);
    mockEmbeddingService.indexDocument.mockRejectedValue(new Error('Embedding failed'));

    const res = await request(app)
      .post('/api/search/index-all');

    expect(res.status).toBe(200);
    expect(res.body.details.errors).toHaveLength(1);
    expect(res.body.details.errors[0].error).toContain('Embedding failed');
  });
});

describe('GET /api/search/stats', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — returns embedding index statistics', async () => {
    mockEmbeddingService.getIndexStats.mockResolvedValue({
      totalChunks: 250,
      byType: [
        { sourceType: 'rfp_document', chunkCount: 150, docCount: 5 },
        { sourceType: 'generated_proposal', chunkCount: 100, docCount: 3 },
      ],
    });

    const res = await request(app)
      .get('/api/search/stats');

    expect(res.status).toBe(200);
    expect(res.body.totalChunks).toBe(250);
    expect(res.body.byType).toHaveLength(2);
  });
});
