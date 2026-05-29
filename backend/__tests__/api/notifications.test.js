/**
 * API tests for /api/notifications
 */

process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'rfp_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'test';

const request = require('supertest');

const mockNotification = {
  findAndCountAll: jest.fn(),
  findAll: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  findByPk: jest.fn(),
};

const mockSequelize = {
  authenticate: jest.fn(),
  sync: jest.fn(),
  close: jest.fn(),
  fn: jest.fn((fnName, col) => `${fnName}(${col})`),
  col: jest.fn((name) => name),
};

const mockModels = {
  Rfp: { findAll: jest.fn(), findByPk: jest.fn() },
  Vendor: { findAll: jest.fn(), findByPk: jest.fn() },
  RfpVendor: {},
  Proposal: { findAll: jest.fn(), findByPk: jest.fn(), update: jest.fn() },
  Comparison: { create: jest.fn() },
  RfpDocument: { create: jest.fn(), findAll: jest.fn(), findByPk: jest.fn() },
  GeneratedProposal: { create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), count: jest.fn(), destroy: jest.fn() },
  DocumentEmbedding: {},
  RiskAnalysis: { create: jest.fn(), findByPk: jest.fn(), findAll: jest.fn() },
  ChatConversation: { create: jest.fn(), findByPk: jest.fn(), findAll: jest.fn(), update: jest.fn() },
  ChatMessage: { create: jest.fn(), findAll: jest.fn(), count: jest.fn(), destroy: jest.fn() },
  User: { findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn(), scope: jest.fn() },
  Notification: mockNotification,
  sequelize: mockSequelize,
};

jest.mock('../../src/models', () => mockModels);
jest.mock('../../src/config/database', () => mockSequelize);

jest.mock('../../src/services/aiService', () => ({}));
jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn(),
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
jest.mock('../../src/services/notificationService', () => ({
  sendNotification: jest.fn().mockResolvedValue({ status: 'sent' }),
  registerWorker: jest.fn(),
}));

jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 1, email: 'test@test.com', role: 'admin' };
    next();
  },
  requireRole: () => (req, res, next) => next(),
}));

const { createApp } = require('../../src/app');
const app = createApp();

describe('GET /api/notifications', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — returns paginated notifications', async () => {
    const mockNotifs = [
      { id: 1, type: 'rfp-sent', recipientEmail: 'vendor@test.com', subject: 'RFP-0001', status: 'sent', createdAt: new Date().toISOString() },
      { id: 2, type: 'proposal-received', recipientEmail: 'test@test.com', subject: 'New proposal', status: 'sent', createdAt: new Date().toISOString() },
    ];
    mockNotification.findAndCountAll.mockResolvedValue({ count: 2, rows: mockNotifs });

    const res = await request(app).get('/api/notifications');

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(2);
    expect(res.body.pagination).toEqual(expect.objectContaining({
      page: 1,
      total: 2,
    }));
    expect(mockNotification.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recipientId: 1, recipientType: 'user' },
        limit: 20,
        offset: 0,
      })
    );
  });

  test('200 — filters by type', async () => {
    mockNotification.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    const res = await request(app).get('/api/notifications?type=rfp-sent');

    expect(res.status).toBe(200);
    expect(mockNotification.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recipientId: 1, recipientType: 'user', type: 'rfp-sent' },
      })
    );
  });

  test('200 — filters by status', async () => {
    mockNotification.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    const res = await request(app).get('/api/notifications?status=failed');

    expect(res.status).toBe(200);
    expect(mockNotification.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recipientId: 1, recipientType: 'user', status: 'failed' },
      })
    );
  });

  test('200 — paginates correctly', async () => {
    mockNotification.findAndCountAll.mockResolvedValue({ count: 50, rows: [] });

    const res = await request(app).get('/api/notifications?page=3&limit=10');

    expect(res.status).toBe(200);
    expect(mockNotification.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10,
        offset: 20,
      })
    );
    expect(res.body.pagination).toEqual(expect.objectContaining({
      page: 3,
      limit: 10,
      total: 50,
      totalPages: 5,
    }));
  });
});

describe('GET /api/notifications/stats', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — returns notification stats', async () => {
    mockNotification.count
      .mockResolvedValueOnce(25)  // total
      .mockResolvedValueOnce(20)  // sent
      .mockResolvedValueOnce(3)   // failed
      .mockResolvedValueOnce(2)   // queued
      .mockResolvedValueOnce(8);  // recent

    mockNotification.findAll.mockResolvedValue([
      { type: 'rfp-sent', count: '15' },
      { type: 'proposal-received', count: '10' },
    ]);

    const res = await request(app).get('/api/notifications/stats');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(25);
    expect(res.body.sent).toBe(20);
    expect(res.body.failed).toBe(3);
    expect(res.body.queued).toBe(2);
    expect(res.body.recentCount).toBe(8);
    expect(res.body.byType).toEqual({
      'rfp-sent': 15,
      'proposal-received': 10,
    });
  });

  test('200 — returns zeros when no notifications', async () => {
    mockNotification.count.mockResolvedValue(0);
    mockNotification.findAll.mockResolvedValue([]);

    const res = await request(app).get('/api/notifications/stats');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.sent).toBe(0);
    expect(res.body.byType).toEqual({});
  });
});
