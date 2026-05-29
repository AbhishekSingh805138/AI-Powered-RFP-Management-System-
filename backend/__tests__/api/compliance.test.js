/**
 * API endpoint tests for /api/compliance (Phase 2 — Compliance Checker).
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
  RfpDocument: { findByPk: jest.fn(), findAll: jest.fn(), create: jest.fn() },
  GeneratedProposal: { findByPk: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), create: jest.fn(), count: jest.fn(), destroy: jest.fn() },
  Rfp: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  Vendor: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  RfpVendor: { findOrCreate: jest.fn() },
  Proposal: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn(), update: jest.fn() },
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

const mockComplianceService = {
  checkCompliance: jest.fn(),
};
jest.mock('../../src/services/complianceService', () => mockComplianceService);
jest.mock('../../src/services/aiService', () => ({
  parseRfpFromNaturalLanguage: jest.fn(),
  parseVendorProposal: jest.fn(),
  compareProposals: jest.fn(),
  extractRequirements: jest.fn(),
  generateProposal: jest.fn(),
}));
jest.mock('../../src/services/embeddingService', () => ({
  indexDocument: jest.fn(),
  getIndexStats: jest.fn(),
}));
jest.mock('../../src/services/searchService', () => ({
  ragSearch: jest.fn(),
}));
jest.mock('../../src/services/emailService', () => ({
  sendRfpEmail: jest.fn(),
  fetchInboundEmails: jest.fn().mockResolvedValue([]),
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
const {
  createMockRfpDocument,
  createMockGeneratedProposal,
  createMockExtractedData,
} = require('../helpers/mockFactories');

const app = createApp();

describe('POST /api/compliance/check', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — runs compliance check with generated proposal', async () => {
    const rfpDoc = createMockRfpDocument({ id: 1 });
    const genProposal = createMockGeneratedProposal({ id: 5, rfpDocumentId: 1 });

    mockModels.RfpDocument.findByPk.mockResolvedValue(rfpDoc);
    mockModels.GeneratedProposal.findByPk.mockResolvedValue(genProposal);

    const complianceResult = {
      overall_score: 85,
      overall_status: 'partially_compliant',
      summary: 'Good compliance overall.',
      statistics: { total_requirements: 10, fully_addressed: 8, partially_addressed: 1, not_addressed: 1, risks_identified: 2 },
      technical_compliance: [],
      compliance_requirements: [],
      deliverable_compliance: [],
      budget_compliance: { status: 'within_budget' },
      timeline_compliance: { status: 'meets_deadline' },
      risks: [],
      strengths: ['Strong technical approach'],
      improvement_areas: ['Missing certifications'],
    };
    mockComplianceService.checkCompliance.mockResolvedValue(complianceResult);

    const res = await request(app)
      .post('/api/compliance/check')
      .send({ rfpDocumentId: 1, generatedProposalId: 5 });

    expect(res.status).toBe(200);
    expect(res.body.overall_score).toBe(85);
    expect(res.body.rfpDocumentId).toBe(1);
    expect(res.body.generatedProposalId).toBe(5);
    expect(res.body.rfpTitle).toBe(rfpDoc.title);
    expect(res.body.checkedAt).toBeDefined();
    expect(mockComplianceService.checkCompliance).toHaveBeenCalledWith(
      rfpDoc.extractedData,
      genProposal.proposalContent
    );
  });

  test('200 — runs compliance check with raw proposal text', async () => {
    const rfpDoc = createMockRfpDocument({ id: 1 });
    mockModels.RfpDocument.findByPk.mockResolvedValue(rfpDoc);
    mockComplianceService.checkCompliance.mockResolvedValue({ overall_score: 70 });

    const res = await request(app)
      .post('/api/compliance/check')
      .send({ rfpDocumentId: 1, proposalText: 'Our proposal addresses all requirements...' });

    expect(res.status).toBe(200);
    expect(mockComplianceService.checkCompliance).toHaveBeenCalledWith(
      rfpDoc.extractedData,
      'Our proposal addresses all requirements...'
    );
  });

  test('400 — rejects when rfpDocumentId is missing', async () => {
    const res = await request(app)
      .post('/api/compliance/check')
      .send({ generatedProposalId: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'rfpDocumentId' })])
    );
  });

  test('400 — rejects when neither proposal nor text is provided', async () => {
    const rfpDoc = createMockRfpDocument({ id: 1 });
    mockModels.RfpDocument.findByPk.mockResolvedValue(rfpDoc);

    const res = await request(app)
      .post('/api/compliance/check')
      .send({ rfpDocumentId: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('generatedProposalId or proposalText');
  });

  test('404 — returns error when RFP document not found', async () => {
    mockModels.RfpDocument.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/compliance/check')
      .send({ rfpDocumentId: 999, proposalText: 'text' });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('RFP Document not found');
  });

  test('400 — returns error when RFP requirements not extracted', async () => {
    const rfpDoc = createMockRfpDocument({ id: 1, extractedData: null });
    mockModels.RfpDocument.findByPk.mockResolvedValue(rfpDoc);

    const res = await request(app)
      .post('/api/compliance/check')
      .send({ rfpDocumentId: 1, proposalText: 'text' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('extracted first');
  });

  test('404 — returns error when generated proposal not found', async () => {
    const rfpDoc = createMockRfpDocument({ id: 1 });
    mockModels.RfpDocument.findByPk.mockResolvedValue(rfpDoc);
    mockModels.GeneratedProposal.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/compliance/check')
      .send({ rfpDocumentId: 1, generatedProposalId: 999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Generated Proposal not found');
  });
});
