/**
 * API endpoint tests for /api/risk-analysis (Phase 3 — Risk Analyzer).
 */

process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'rfp_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'test';

const request = require('supertest');
const { createMockRfpDocument, createMockGeneratedProposal, createMockExtractedData } = require('../helpers/mockFactories');

// Mock models
const mockModels = {
  RfpDocument: { findByPk: jest.fn(), findAll: jest.fn(), create: jest.fn() },
  GeneratedProposal: { findByPk: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), create: jest.fn(), count: jest.fn(), destroy: jest.fn() },
  RiskAnalysis: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  ChatConversation: { create: jest.fn(), findByPk: jest.fn(), findAll: jest.fn(), update: jest.fn() },
  ChatMessage: { create: jest.fn(), findAll: jest.fn(), count: jest.fn(), destroy: jest.fn() },
  Rfp: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  Vendor: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  RfpVendor: { findOrCreate: jest.fn() },
  Proposal: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn(), update: jest.fn() },
  Comparison: { create: jest.fn() },
  DocumentEmbedding: {},
  User: { findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn(), scope: jest.fn() },
  sequelize: { authenticate: jest.fn(), sync: jest.fn(), close: jest.fn() },
};
jest.mock('../../src/models', () => mockModels);
jest.mock('../../src/config/database', () => ({}));

const mockRiskService = {
  analyzeRisks: jest.fn(),
  compareRiskProfiles: jest.fn(),
};
jest.mock('../../src/services/riskService', () => mockRiskService);
jest.mock('../../src/services/chatService', () => ({
  chat: jest.fn(),
  generateConversationTitle: jest.fn(),
  getSuggestedQuestions: jest.fn(),
}));
jest.mock('../../src/services/aiService', () => ({
  parseRfpFromNaturalLanguage: jest.fn(),
  parseVendorProposal: jest.fn(),
  compareProposals: jest.fn(),
  extractRequirements: jest.fn(),
  generateProposal: jest.fn(),
}));
jest.mock('../../src/services/embeddingService', () => ({
  indexDocument: jest.fn(),
  semanticSearch: jest.fn(),
  getIndexStats: jest.fn(),
}));
jest.mock('../../src/services/searchService', () => ({ ragSearch: jest.fn() }));
jest.mock('../../src/services/complianceService', () => ({ checkCompliance: jest.fn() }));
jest.mock('../../src/services/emailService', () => ({
  sendRfpEmail: jest.fn(),
  fetchInboundEmails: jest.fn().mockResolvedValue([]),
}));
jest.mock('pdf-parse', () => jest.fn());

jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 1, email: 'test@test.com', role: 'admin' };
    next();
  },
  requireRole: () => (req, res, next) => next(),
}));

const { createApp } = require('../../src/app');
const app = createApp();

describe('Risk Analysis API — /api/risk-analysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST / — Analyze Risks', () => {
    test('returns 400 if rfpDocumentId is missing', async () => {
      const res = await request(app).post('/api/risk-analysis').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('rfpDocumentId');
    });

    test('returns 404 if RFP document not found', async () => {
      mockModels.RfpDocument.findByPk.mockResolvedValue(null);
      const res = await request(app).post('/api/risk-analysis').send({ rfpDocumentId: 999 });
      expect(res.status).toBe(404);
    });

    test('returns 400 if requirements not extracted', async () => {
      mockModels.RfpDocument.findByPk.mockResolvedValue({ id: 1, extractedData: null });
      const res = await request(app).post('/api/risk-analysis').send({ rfpDocumentId: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('extracted');
    });

    test('returns 404 if generated proposal not found', async () => {
      mockModels.RfpDocument.findByPk.mockResolvedValue({ id: 1, extractedData: createMockExtractedData() });
      mockModels.GeneratedProposal.findByPk.mockResolvedValue(null);
      const res = await request(app).post('/api/risk-analysis').send({ rfpDocumentId: 1, generatedProposalId: 999 });
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Proposal');
    });

    test('creates risk analysis and returns 201', async () => {
      const rfpDoc = createMockRfpDocument();
      const mockAnalysis = {
        id: 1,
        rfpDocumentId: 1,
        status: 'analyzing',
        update: jest.fn(async function (d) { Object.assign(this, d); return this; }),
      };

      mockModels.RfpDocument.findByPk.mockResolvedValue(rfpDoc);
      mockModels.RiskAnalysis.create.mockResolvedValue(mockAnalysis);
      mockRiskService.analyzeRisks.mockResolvedValue({
        overall_risk_score: 55,
        overall_risk_level: 'medium',
      });

      const res = await request(app).post('/api/risk-analysis').send({ rfpDocumentId: 1 });

      expect(res.status).toBe(201);
      expect(mockRiskService.analyzeRisks).toHaveBeenCalledWith(rfpDoc, null);
      expect(mockAnalysis.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed', overallRiskScore: 55 })
      );
    });

    test('analyzes with proposal when generatedProposalId provided', async () => {
      const rfpDoc = createMockRfpDocument();
      const proposal = createMockGeneratedProposal();
      const mockAnalysis = {
        id: 2,
        status: 'analyzing',
        update: jest.fn(async function (d) { Object.assign(this, d); return this; }),
      };

      mockModels.RfpDocument.findByPk.mockResolvedValue(rfpDoc);
      mockModels.GeneratedProposal.findByPk.mockResolvedValue(proposal);
      mockModels.RiskAnalysis.create.mockResolvedValue(mockAnalysis);
      mockRiskService.analyzeRisks.mockResolvedValue({ overall_risk_score: 35, overall_risk_level: 'low' });

      const res = await request(app).post('/api/risk-analysis').send({ rfpDocumentId: 1, generatedProposalId: 1 });

      expect(res.status).toBe(201);
      expect(mockRiskService.analyzeRisks).toHaveBeenCalledWith(rfpDoc, proposal);
    });
  });

  describe('GET /:id — Get Risk Analysis', () => {
    test('returns 404 when not found', async () => {
      mockModels.RiskAnalysis.findByPk.mockResolvedValue(null);
      const res = await request(app).get('/api/risk-analysis/999');
      expect(res.status).toBe(404);
    });

    test('returns analysis with includes', async () => {
      const analysis = { id: 1, overallRiskScore: 60, analysisData: {}, rfpDocument: { id: 1 } };
      mockModels.RiskAnalysis.findByPk.mockResolvedValue(analysis);

      const res = await request(app).get('/api/risk-analysis/1');
      expect(res.status).toBe(200);
      expect(res.body.overallRiskScore).toBe(60);
    });
  });

  describe('GET / — List Risk Analyses', () => {
    test('returns all analyses', async () => {
      mockModels.RiskAnalysis.findAll.mockResolvedValue([
        { id: 1, overallRiskScore: 40 },
        { id: 2, overallRiskScore: 70 },
      ]);

      const res = await request(app).get('/api/risk-analysis');
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
    });

    test('filters by rfpDocumentId query param', async () => {
      mockModels.RiskAnalysis.findAll.mockResolvedValue([{ id: 1, rfpDocumentId: 5 }]);
      const res = await request(app).get('/api/risk-analysis?rfpDocumentId=5');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /compare — Compare Risk Profiles', () => {
    test('returns 400 if less than 2 analysisIds', async () => {
      const res = await request(app).post('/api/risk-analysis/compare').send({ analysisIds: [1] });
      expect(res.status).toBe(400);
    });

    test('returns 400 if not enough completed analyses found', async () => {
      mockModels.RiskAnalysis.findAll.mockResolvedValue([{ id: 1 }]);
      const res = await request(app).post('/api/risk-analysis/compare').send({ analysisIds: [1, 2] });
      expect(res.status).toBe(400);
    });

    test('compares analyses successfully', async () => {
      const analyses = [
        { id: 1, overallRiskScore: 45, status: 'completed' },
        { id: 2, overallRiskScore: 72, status: 'completed' },
      ];
      mockModels.RiskAnalysis.findAll.mockResolvedValue(analyses);
      mockRiskService.compareRiskProfiles.mockResolvedValue({ summary: 'Comparison done', common_risks: [] });

      const res = await request(app).post('/api/risk-analysis/compare').send({ analysisIds: [1, 2] });
      expect(res.status).toBe(200);
      expect(res.body.summary).toBe('Comparison done');
      expect(res.body.comparedAt).toBeDefined();
    });
  });

  describe('DELETE /:id — Delete Risk Analysis', () => {
    test('returns 404 when not found', async () => {
      mockModels.RiskAnalysis.findByPk.mockResolvedValue(null);
      const res = await request(app).delete('/api/risk-analysis/999');
      expect(res.status).toBe(404);
    });

    test('deletes successfully', async () => {
      const analysis = { id: 1, destroy: jest.fn() };
      mockModels.RiskAnalysis.findByPk.mockResolvedValue(analysis);

      const res = await request(app).delete('/api/risk-analysis/1');
      expect(res.status).toBe(200);
      expect(analysis.destroy).toHaveBeenCalled();
    });
  });
});
