/**
 * API endpoint tests for /api/chat (Phase 3 — AI Chatbot).
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
  RiskAnalysis: { create: jest.fn(), findByPk: jest.fn(), findAll: jest.fn() },
  ChatConversation: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
  },
  ChatMessage: {
    create: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
    destroy: jest.fn(),
  },
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

const mockChatService = {
  chat: jest.fn(),
  generateConversationTitle: jest.fn(),
  getSuggestedQuestions: jest.fn(),
};
jest.mock('../../src/services/chatService', () => mockChatService);
jest.mock('../../src/services/riskService', () => ({ analyzeRisks: jest.fn(), compareRiskProfiles: jest.fn() }));
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

describe('Chat API — /api/chat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /conversations — Create Conversation', () => {
    test('creates a new conversation with default title', async () => {
      const mockConv = { id: 1, title: 'New Conversation', status: 'active', lastMessageAt: new Date() };
      mockModels.ChatConversation.create.mockResolvedValue(mockConv);

      const res = await request(app).post('/api/chat/conversations').send({});
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('New Conversation');
    });

    test('creates with custom title', async () => {
      const mockConv = { id: 2, title: 'My Chat', status: 'active', lastMessageAt: new Date() };
      mockModels.ChatConversation.create.mockResolvedValue(mockConv);

      const res = await request(app).post('/api/chat/conversations').send({ title: 'My Chat' });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('My Chat');
    });
  });

  describe('GET /conversations — List Conversations', () => {
    test('returns active conversations', async () => {
      mockModels.ChatConversation.findAndCountAll.mockResolvedValue({
        count: 2,
        rows: [
          { id: 1, title: 'Conv 1', status: 'active' },
          { id: 2, title: 'Conv 2', status: 'active' },
        ],
      });

      const res = await request(app).get('/api/chat/conversations');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(2);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
    });

    test('filters by status query param', async () => {
      mockModels.ChatConversation.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
      const res = await request(app).get('/api/chat/conversations?status=archived');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /conversations/:id — Get Conversation', () => {
    test('returns 404 when not found', async () => {
      mockModels.ChatConversation.findByPk.mockResolvedValue(null);
      const res = await request(app).get('/api/chat/conversations/999');
      expect(res.status).toBe(404);
    });

    test('returns conversation with messages', async () => {
      const conv = {
        id: 1,
        title: 'Test Conv',
        messages: [
          { id: 1, role: 'user', content: 'Hello' },
          { id: 2, role: 'assistant', content: 'Hi there!' },
        ],
      };
      mockModels.ChatConversation.findByPk.mockResolvedValue(conv);

      const res = await request(app).get('/api/chat/conversations/1');
      expect(res.status).toBe(200);
      expect(res.body.messages.length).toBe(2);
    });
  });

  describe('POST /conversations/:id/messages — Send Message', () => {
    test('returns 400 if content is empty', async () => {
      const res = await request(app).post('/api/chat/conversations/1/messages').send({ content: '' });
      expect(res.status).toBe(400);
    });

    test('returns 400 if content is missing', async () => {
      const res = await request(app).post('/api/chat/conversations/1/messages').send({});
      expect(res.status).toBe(400);
    });

    test('returns 404 if conversation not found', async () => {
      mockModels.ChatConversation.findByPk.mockResolvedValue(null);
      const res = await request(app).post('/api/chat/conversations/999/messages').send({ content: 'Hello' });
      expect(res.status).toBe(404);
    });

    test('sends message and returns AI response', async () => {
      const conv = { id: 1, title: 'New Conversation', update: jest.fn() };
      mockModels.ChatConversation.findByPk.mockResolvedValue(conv);
      mockModels.ChatMessage.count.mockResolvedValue(0); // Not enough for auto-title

      mockChatService.chat.mockResolvedValue({
        userMessage: { id: 1, role: 'user', content: 'What is the budget?', createdAt: new Date() },
        message: {
          id: 2,
          role: 'assistant',
          content: 'The budget is $500,000.',
          sources: [{ sourceTitle: 'RFP Doc 1', similarity: 0.9 }],
          metadata: { model: 'gpt-4o-mini', responseTimeMs: 800 },
          createdAt: new Date(),
        },
      });

      const res = await request(app).post('/api/chat/conversations/1/messages').send({ content: 'What is the budget?' });
      expect(res.status).toBe(200);
      expect(res.body.message.content).toBe('The budget is $500,000.');
      expect(res.body.message.sources).toBeDefined();
    });

    test('auto-generates title after 2 messages', async () => {
      const conv = { id: 1, title: 'New Conversation', update: jest.fn() };
      mockModels.ChatConversation.findByPk.mockResolvedValue(conv);
      mockModels.ChatMessage.count.mockResolvedValue(2);
      mockModels.ChatMessage.findAll.mockResolvedValue([
        { role: 'user', content: 'Budget question' },
        { role: 'assistant', content: 'Budget is...' },
      ]);

      mockChatService.chat.mockResolvedValue({
        userMessage: { id: 3, role: 'user', content: 'test' },
        message: { id: 4, role: 'assistant', content: 'Response' },
      });
      mockChatService.generateConversationTitle.mockResolvedValue('Budget Discussion');

      const res = await request(app).post('/api/chat/conversations/1/messages').send({ content: 'test' });
      expect(res.status).toBe(200);
      expect(res.body.conversationTitle).toBe('Budget Discussion');
    });
  });

  describe('PUT /conversations/:id/archive — Archive Conversation', () => {
    test('returns 404 when not found', async () => {
      mockModels.ChatConversation.findByPk.mockResolvedValue(null);
      const res = await request(app).put('/api/chat/conversations/999/archive');
      expect(res.status).toBe(404);
    });

    test('archives conversation', async () => {
      const conv = { id: 1, status: 'active', update: jest.fn(async function (d) { Object.assign(this, d); return this; }) };
      mockModels.ChatConversation.findByPk.mockResolvedValue(conv);

      const res = await request(app).put('/api/chat/conversations/1/archive');
      expect(res.status).toBe(200);
      expect(conv.update).toHaveBeenCalledWith({ status: 'archived' });
    });
  });

  describe('DELETE /conversations/:id — Delete Conversation', () => {
    test('returns 404 when not found', async () => {
      mockModels.ChatConversation.findByPk.mockResolvedValue(null);
      const res = await request(app).delete('/api/chat/conversations/999');
      expect(res.status).toBe(404);
    });

    test('deletes conversation and messages', async () => {
      const conv = { id: 1, destroy: jest.fn() };
      mockModels.ChatConversation.findByPk.mockResolvedValue(conv);
      mockModels.ChatMessage.destroy.mockResolvedValue(5);

      const res = await request(app).delete('/api/chat/conversations/1');
      expect(res.status).toBe(200);
      expect(mockModels.ChatMessage.destroy).toHaveBeenCalledWith({ where: { conversationId: 1 } });
      expect(conv.destroy).toHaveBeenCalled();
    });
  });

  describe('GET /conversations/:id/suggestions — Get Suggested Questions', () => {
    test('returns 404 when conversation not found', async () => {
      mockModels.ChatConversation.findByPk.mockResolvedValue(null);
      const res = await request(app).get('/api/chat/conversations/999/suggestions');
      expect(res.status).toBe(404);
    });

    test('returns suggested questions', async () => {
      mockModels.ChatConversation.findByPk.mockResolvedValue({ id: 1 });
      mockChatService.getSuggestedQuestions.mockResolvedValue(['Q1?', 'Q2?', 'Q3?']);

      const res = await request(app).get('/api/chat/conversations/1/suggestions');
      expect(res.status).toBe(200);
      expect(res.body.questions.length).toBe(3);
    });
  });
});
