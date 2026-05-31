/**
 * API tests for GET /api/analytics
 */

process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'rfp_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'test';

const request = require('supertest');

const mockModels = {
  Rfp: { findAll: jest.fn(), findByPk: jest.fn() },
  Vendor: { findAll: jest.fn(), findByPk: jest.fn() },
  RfpVendor: {},
  Proposal: { findAll: jest.fn(), findByPk: jest.fn() },
  Comparison: {},
  RfpDocument: { create: jest.fn(), findAll: jest.fn(), findByPk: jest.fn() },
  GeneratedProposal: { create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), count: jest.fn(), destroy: jest.fn() },
  DocumentEmbedding: {},
  RiskAnalysis: { create: jest.fn(), findByPk: jest.fn(), findAll: jest.fn() },
  ChatConversation: { create: jest.fn(), findByPk: jest.fn(), findAll: jest.fn(), update: jest.fn() },
  ChatMessage: { create: jest.fn(), findAll: jest.fn(), count: jest.fn(), destroy: jest.fn() },
  User: { findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn(), scope: jest.fn() },
  sequelize: { authenticate: jest.fn(), sync: jest.fn(), close: jest.fn() },
};
jest.mock('../../src/models', () => mockModels);
jest.mock('../../src/config/database', () => ({}));

jest.mock('../../src/services/aiService', () => ({}));
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
jest.mock('../../src/services/riskService', () => ({ analyzeRisks: jest.fn(), compareRiskProfiles: jest.fn() }));
jest.mock('../../src/services/chatService', () => ({
  chat: jest.fn(), generateConversationTitle: jest.fn(), getSuggestedQuestions: jest.fn(),
}));
jest.mock('../../src/services/exportService', () => ({
  generatePdf: jest.fn(), generateDocx: jest.fn(),
}));

jest.mock('../../src/middleware/auth', () => ({
  requirePermission: (permission) => (req, res, next) => {
    const ROLE_PERMISSIONS = {
      admin: ['*'],
      manager: [
        'rfp:read', 'rfp:write', 'rfp:delete',
        'proposal:read', 'proposal:write', 'proposal:finalize', 'proposal:compare',
        'vendor:read', 'vendor:write',
        'compliance:check', 'risk:manage',
        'search:query', 'search:index',
        'chat:access', 'chat:delete',
        'analytics:read'
      ],
      viewer: [
        'rfp:read',
        'proposal:read',
        'vendor:read',
        'search:query',
        'chat:access'
      ]
    };
    const role = req.user?.role || 'viewer';
    const permissions = ROLE_PERMISSIONS[role] || [];
    if (permissions.includes('*') || permissions.includes(permission)) {
      return next();
    }
    return res.status(403).json({ error: 'Insufficient permissions' });
  },
  authenticate: (req, res, next) => {
    req.user = { id: 1, email: 'test@test.com', role: 'admin' };
    next();
  },
  requireRole: () => (req, res, next) => next(),
}));

const { createApp } = require('../../src/app');
const app = createApp();

describe('GET /api/analytics', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — returns analytics summary and chart data', async () => {
    const now = new Date().toISOString();
    mockModels.Rfp.findAll.mockResolvedValue([
      { id: 1, status: 'draft', budget: 50000, createdAt: now },
      { id: 2, status: 'sent', budget: 100000, createdAt: now },
      { id: 3, status: 'draft', budget: null, createdAt: now },
    ]);
    mockModels.Vendor.findAll.mockResolvedValue([
      { id: 1, createdAt: now },
      { id: 2, createdAt: now },
    ]);
    mockModels.Proposal.findAll.mockResolvedValue([
      { id: 1, status: 'parsed', totalPrice: 45000, score: 85, sourceType: 'email', createdAt: now },
      { id: 2, status: 'received', totalPrice: 60000, score: 72, sourceType: 'pdf', createdAt: now },
    ]);
    mockModels.RfpDocument.findAll.mockResolvedValue([
      { id: 1, status: 'extracted', createdAt: now },
      { id: 2, status: 'uploaded', createdAt: now },
    ]);
    mockModels.RiskAnalysis.findAll.mockResolvedValue([
      { id: 1, overallRiskLevel: 'low', overallRiskScore: 25, status: 'completed', createdAt: now },
      { id: 2, overallRiskLevel: 'high', overallRiskScore: 75, status: 'completed', createdAt: now },
    ]);
    mockModels.ChatConversation.findAll.mockResolvedValue([
      { id: 1, createdAt: now },
    ]);

    const res = await request(app).get('/api/analytics');

    expect(res.status).toBe(200);

    // Summary
    expect(res.body.summary).toEqual(expect.objectContaining({
      totalRfps: 3,
      totalVendors: 2,
      totalProposals: 2,
      analyzedDocuments: 1,
      riskAnalyses: 2,
      chatConversations: 1,
      totalBudget: 150000,
      avgBudget: 75000,
    }));
    expect(res.body.summary.avgProposalScore).toBeCloseTo(78.5, 0);

    // Charts
    expect(res.body.charts.rfpStatusBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'draft', value: 2 }),
        expect.objectContaining({ name: 'sent', value: 1 }),
      ])
    );

    expect(res.body.charts.riskLevelDistribution).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'low', value: 1 }),
        expect.objectContaining({ name: 'high', value: 1 }),
      ])
    );

    expect(res.body.charts.proposalSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'email', value: 1 }),
        expect.objectContaining({ name: 'pdf', value: 1 }),
      ])
    );

    expect(res.body.charts.activityTimeline).toBeInstanceOf(Array);
    expect(res.body.charts.activityTimeline.length).toBeGreaterThan(0);
  });

  test('200 — returns empty analytics when no data exists', async () => {
    mockModels.Rfp.findAll.mockResolvedValue([]);
    mockModels.Vendor.findAll.mockResolvedValue([]);
    mockModels.Proposal.findAll.mockResolvedValue([]);
    mockModels.RfpDocument.findAll.mockResolvedValue([]);
    mockModels.RiskAnalysis.findAll.mockResolvedValue([]);
    mockModels.ChatConversation.findAll.mockResolvedValue([]);

    const res = await request(app).get('/api/analytics');

    expect(res.status).toBe(200);
    expect(res.body.summary.totalRfps).toBe(0);
    expect(res.body.summary.totalVendors).toBe(0);
    expect(res.body.summary.totalBudget).toBe(0);
    expect(res.body.summary.avgBudget).toBe(0);
    expect(res.body.summary.avgProposalScore).toBe(0);
    expect(res.body.charts.rfpStatusBreakdown).toEqual([]);
    expect(res.body.charts.activityTimeline).toBeInstanceOf(Array);
  });

  test('200 — timeline covers 30 days', async () => {
    mockModels.Rfp.findAll.mockResolvedValue([]);
    mockModels.Vendor.findAll.mockResolvedValue([]);
    mockModels.Proposal.findAll.mockResolvedValue([]);
    mockModels.RfpDocument.findAll.mockResolvedValue([]);
    mockModels.RiskAnalysis.findAll.mockResolvedValue([]);
    mockModels.ChatConversation.findAll.mockResolvedValue([]);

    const res = await request(app).get('/api/analytics');

    // Should have 31 entries (30 days ago to today inclusive)
    expect(res.body.charts.activityTimeline.length).toBe(31);
    // Each entry should have the right shape
    const first = res.body.charts.activityTimeline[0];
    expect(first).toHaveProperty('date');
    expect(first).toHaveProperty('rfps');
    expect(first).toHaveProperty('documents');
    expect(first).toHaveProperty('proposals');
    expect(first).toHaveProperty('risks');
  });

  test('200 — handles proposals with no scores', async () => {
    mockModels.Rfp.findAll.mockResolvedValue([]);
    mockModels.Vendor.findAll.mockResolvedValue([]);
    mockModels.Proposal.findAll.mockResolvedValue([
      { id: 1, status: 'received', totalPrice: null, score: null, sourceType: 'manual', createdAt: new Date().toISOString() },
    ]);
    mockModels.RfpDocument.findAll.mockResolvedValue([]);
    mockModels.RiskAnalysis.findAll.mockResolvedValue([]);
    mockModels.ChatConversation.findAll.mockResolvedValue([]);

    const res = await request(app).get('/api/analytics');

    expect(res.status).toBe(200);
    expect(res.body.summary.avgProposalScore).toBe(0);
    expect(res.body.summary.totalProposals).toBe(1);
  });

  test('200 — only counts completed risk analyses for distribution', async () => {
    mockModels.Rfp.findAll.mockResolvedValue([]);
    mockModels.Vendor.findAll.mockResolvedValue([]);
    mockModels.Proposal.findAll.mockResolvedValue([]);
    mockModels.RfpDocument.findAll.mockResolvedValue([]);
    mockModels.RiskAnalysis.findAll.mockResolvedValue([
      { id: 1, overallRiskLevel: 'high', overallRiskScore: 80, status: 'completed', createdAt: new Date().toISOString() },
      { id: 2, overallRiskLevel: null, overallRiskScore: null, status: 'pending', createdAt: new Date().toISOString() },
      { id: 3, overallRiskLevel: null, overallRiskScore: null, status: 'analyzing', createdAt: new Date().toISOString() },
    ]);
    mockModels.ChatConversation.findAll.mockResolvedValue([]);

    const res = await request(app).get('/api/analytics');

    expect(res.status).toBe(200);
    expect(res.body.summary.riskAnalyses).toBe(3); // total count
    const highRisk = res.body.charts.riskLevelDistribution.find((r) => r.name === 'high');
    expect(highRisk.value).toBe(1);
    const pendingRisk = res.body.charts.riskLevelDistribution.find((r) => r.name === 'low');
    expect(pendingRisk.value).toBe(0); // pending ones not counted
  });
});
