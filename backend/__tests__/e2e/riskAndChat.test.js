/**
 * E2E Test: Risk Analysis & AI Chatbot (Phase 3)
 *
 * Risk Analysis flow:
 *   Analyze risks → View analysis → List analyses → Compare → Delete
 *
 * AI Chatbot flow:
 *   Create conversation → Send messages → Auto-title → Get suggestions →
 *   Archive → List (active vs archived) → Delete
 */

const request = require('supertest');
const { createMockExtractedData, createMockProposalContent } = require('../helpers/mockFactories');

// ── In-memory stores ──────────────────────────────────────────────
let rfpDocuments = [];
let generatedProposals = [];
let riskAnalyses = [];
let chatConversations = [];
let chatMessages = [];
let autoId = 1;

const mockModels = {
  RfpDocument: {
    findByPk: jest.fn(async (id) => rfpDocuments.find((d) => d.id === parseInt(id, 10)) || null),
    findAll: jest.fn(async () => rfpDocuments),
  },
  GeneratedProposal: {
    findByPk: jest.fn(async (id) => generatedProposals.find((p) => p.id === parseInt(id, 10)) || null),
  },
  RiskAnalysis: {
    create: jest.fn(async (data) => {
      const ra = {
        id: autoId++, ...data,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        update: jest.fn(async function (u) { Object.assign(this, u); return this; }),
        destroy: jest.fn(async function () { riskAnalyses = riskAnalyses.filter((x) => x.id !== this.id); }),
        toJSON: function () { const { update, destroy, toJSON, ...rest } = this; return rest; },
      };
      riskAnalyses.push(ra);
      return ra;
    }),
    findByPk: jest.fn(async (id) => {
      const ra = riskAnalyses.find((x) => x.id === parseInt(id, 10));
      if (!ra) return null;
      ra.rfpDocument = rfpDocuments.find((d) => d.id === ra.rfpDocumentId) || null;
      ra.generatedProposal = generatedProposals.find((p) => p.id === ra.generatedProposalId) || null;
      return ra;
    }),
    findAll: jest.fn(async ({ where } = {}) => {
      let filtered = [...riskAnalyses];
      if (where?.id) filtered = filtered.filter((x) => where.id.includes(x.id));
      if (where?.status) filtered = filtered.filter((x) => x.status === where.status);
      // Attach parent documents
      filtered.forEach((ra) => {
        ra.rfpDocument = rfpDocuments.find((d) => d.id === ra.rfpDocumentId) || null;
      });
      return filtered;
    }),
    findAndCountAll: jest.fn(async ({ where, limit, offset } = {}) => {
      let filtered = [...riskAnalyses];
      if (where?.rfpDocumentId) filtered = filtered.filter((x) => x.rfpDocumentId == where.rfpDocumentId);
      // Attach parent documents
      filtered.forEach((ra) => {
        ra.rfpDocument = rfpDocuments.find((d) => d.id === ra.rfpDocumentId) || null;
      });
      return { count: filtered.length, rows: filtered.slice(offset || 0, (offset || 0) + (limit || 20)) };
    }),
  },
  ChatConversation: {
    create: jest.fn(async (data) => {
      const conv = {
        id: autoId++, ...data,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        messages: [],
        update: jest.fn(async function (u) { Object.assign(this, u); return this; }),
        destroy: jest.fn(async function () { chatConversations = chatConversations.filter((c) => c.id !== this.id); }),
      };
      chatConversations.push(conv);
      return conv;
    }),
    findByPk: jest.fn(async (id) => {
      const conv = chatConversations.find((c) => c.id === parseInt(id, 10));
      if (!conv) return null;
      conv.messages = chatMessages.filter((m) => m.conversationId === conv.id);
      return conv;
    }),
    findAndCountAll: jest.fn(async ({ where, limit, offset } = {}) => {
      let filtered = [...chatConversations];
      if (where?.userId) filtered = filtered.filter((c) => c.userId === where.userId);
      if (where?.status) filtered = filtered.filter((c) => c.status === where.status);
      return { count: filtered.length, rows: filtered.slice(offset || 0, (offset || 0) + (limit || 20)) };
    }),
  },
  ChatMessage: {
    create: jest.fn(async (data) => {
      const msg = { id: autoId++, ...data, createdAt: new Date().toISOString() };
      chatMessages.push(msg);
      return msg;
    }),
    count: jest.fn(async ({ where }) => chatMessages.filter((m) => m.conversationId === where.conversationId).length),
    findAll: jest.fn(async ({ where }) => chatMessages.filter((m) => m.conversationId === where.conversationId)),
    destroy: jest.fn(async ({ where }) => {
      chatMessages = chatMessages.filter((m) => m.conversationId !== where.conversationId);
    }),
  },
  User: {
    findByPk: jest.fn(async () => ({ id: 1, email: 'manager@test.com', role: 'manager', status: 'active' })),
  },
  sequelize: { authenticate: jest.fn(), sync: jest.fn(), close: jest.fn() },
};

const mockRiskService = {
  analyzeRisks: jest.fn().mockResolvedValue({
    overall_risk_score: 42,
    overall_risk_level: 'medium',
    categories: [
      {
        category: 'Financial',
        risk_score: 35,
        risk_level: 'low',
        risks: [{ risk: 'Budget overrun', likelihood: 'medium', impact: 'high', mitigation: 'Fixed-price contract' }],
      },
      {
        category: 'Technical',
        risk_score: 55,
        risk_level: 'medium',
        risks: [{ risk: 'Integration complexity', likelihood: 'high', impact: 'medium', mitigation: 'Phased rollout' }],
      },
      {
        category: 'Schedule',
        risk_score: 30,
        risk_level: 'low',
        risks: [{ risk: 'Timeline slip', likelihood: 'low', impact: 'medium', mitigation: 'Buffer weeks' }],
      },
    ],
    recommendations: ['Use phased delivery', 'Add integration testing sprint'],
  }),
  compareRiskProfiles: jest.fn().mockResolvedValue({
    comparison_summary: 'Analysis 1 has lower overall risk.',
    category_comparison: [
      { category: 'Financial', analysis_1: 35, analysis_2: 60 },
      { category: 'Technical', analysis_1: 55, analysis_2: 40 },
    ],
    recommendation: 'Analysis 1 is lower risk overall.',
  }),
};

const mockChatService = {
  chat: jest.fn().mockImplementation(async (convId, content) => {
    // Simulate user + assistant messages
    const userMsg = { id: autoId++, conversationId: convId, role: 'user', content, createdAt: new Date().toISOString() };
    const assistantMsg = {
      id: autoId++, conversationId: convId, role: 'assistant',
      content: `Based on the RFP documents, here is my analysis of "${content}".`,
      sources: [{ sourceType: 'rfp_document', sourceId: 1, similarity: 0.92 }],
      createdAt: new Date().toISOString(),
    };
    chatMessages.push(userMsg, assistantMsg);
    return { userMessage: userMsg, assistantMessage: assistantMsg };
  }),
  generateConversationTitle: jest.fn().mockResolvedValue('RFP Requirements Discussion'),
  getSuggestedQuestions: jest.fn().mockResolvedValue([
    'What are the key compliance requirements?',
    'What is the budget breakdown?',
    'What are the delivery milestones?',
  ]),
};

jest.mock('../../src/models', () => mockModels);
jest.mock('../../src/config/database', () => ({}));
jest.mock('../../src/services/riskService', () => mockRiskService);
jest.mock('../../src/services/chatService', () => mockChatService);
jest.mock('../../src/services/notificationService', () => ({ sendNotification: jest.fn() }));
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
    req.user = { id: 1, email: 'manager@test.com', role: 'manager' };
    next();
  },
  requireRole: () => (req, res, next) => next(),
}));

const { createApp } = require('../../src/app');

let app;

beforeAll(() => { app = createApp(); });

function resetStoresAndSeed() {
  rfpDocuments = [];
  generatedProposals = [];
  riskAnalyses = [];
  chatConversations = [];
  chatMessages = [];
  autoId = 1;
  jest.clearAllMocks();
  // Restore default mocks
  mockRiskService.analyzeRisks.mockResolvedValue({
    overall_risk_score: 42, overall_risk_level: 'medium',
    categories: [
      { category: 'Financial', risk_score: 35, risk_level: 'low', risks: [] },
      { category: 'Technical', risk_score: 55, risk_level: 'medium', risks: [] },
    ],
    recommendations: ['Use phased delivery'],
  });

  // Seed an extracted RFP document and generated proposal
  rfpDocuments.push({
    id: autoId++,
    title: 'Cloud Migration RFP',
    rawText: 'Cloud migration requirements...',
    extractedData: createMockExtractedData(),
    status: 'extracted',
    userId: 1,
    originalFilename: 'cloud-rfp.pdf',
    update: jest.fn(async function (u) { Object.assign(this, u); return this; }),
  });
  generatedProposals.push({
    id: autoId++,
    rfpDocumentId: 1,
    title: 'Cloud Migration Proposal v1',
    proposalContent: createMockProposalContent(),
    status: 'generated',
    version: 1,
  });
}

// ─────────────────────────────────────────────────────────────────
describe('E2E: Risk Analysis Flow', () => {
  describe('Full risk analysis journey', () => {
    let riskId1, riskId2;

    beforeAll(() => { resetStoresAndSeed(); });

    test('Step 1: Analyze risks for an RFP document', async () => {
      const res = await request(app)
        .post('/api/risk-analysis')
        .send({ rfpDocumentId: 1 });

      // pg-boss is mocked (returns null), so sync fallback is used
      expect(res.status).toBe(201);
      expect(res.body.overallRiskScore).toBe(42);
      expect(res.body.overallRiskLevel).toBe('medium');
      expect(res.body.status).toBe('completed');
      riskId1 = res.body.id;
    });

    test('Step 2: Analyze risks with generated proposal included', async () => {
      const res = await request(app)
        .post('/api/risk-analysis')
        .send({ rfpDocumentId: 1, generatedProposalId: 2 });

      expect(res.status).toBe(201);
      expect(res.body.generatedProposalId).toBe(2);
      riskId2 = res.body.id;
    });

    test('Step 3: Get specific risk analysis', async () => {
      const res = await request(app).get(`/api/risk-analysis/${riskId1}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(riskId1);
      expect(res.body.rfpDocument).toBeDefined();
      expect(res.body.rfpDocument.title).toBe('Cloud Migration RFP');
    });

    test('Step 4: List all risk analyses', async () => {
      const res = await request(app).get('/api/risk-analysis');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    test('Step 5: Compare two risk analyses', async () => {
      const res = await request(app)
        .post('/api/risk-analysis/compare')
        .send({ analysisIds: [riskId1, riskId2] });

      expect(res.status).toBe(200);
      expect(res.body.comparison_summary).toBeDefined();
      expect(res.body.category_comparison).toHaveLength(2);
      expect(res.body.analysisIds).toHaveLength(2);
    });

    test('Step 6: Delete a risk analysis', async () => {
      const res = await request(app).delete(`/api/risk-analysis/${riskId1}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');
      expect(riskAnalyses.find((r) => r.id === riskId1)).toBeUndefined();
    });
  });

  // ── Risk edge cases ────────────────────────────────────────────
  describe('Risk analysis edge cases', () => {
    beforeEach(() => { resetStoresAndSeed(); });
    test('rejects analysis for non-existent document', async () => {
      const res = await request(app)
        .post('/api/risk-analysis')
        .send({ rfpDocumentId: 999 });

      expect(res.status).toBe(404);
    });

    test('rejects analysis for un-extracted document', async () => {
      rfpDocuments.push({
        id: autoId++, title: 'Unextracted', extractedData: null,
        status: 'uploaded', userId: 1,
        update: jest.fn(async function (u) { Object.assign(this, u); return this; }),
      });

      const res = await request(app)
        .post('/api/risk-analysis')
        .send({ rfpDocumentId: rfpDocuments[rfpDocuments.length - 1].id });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('extracted first');
    });

    test('compare rejects fewer than 2 analysisIds', async () => {
      const res = await request(app)
        .post('/api/risk-analysis/compare')
        .send({ analysisIds: [1] });

      expect(res.status).toBe(400);
    });

    test('404 for non-existent risk analysis', async () => {
      const res = await request(app).get('/api/risk-analysis/9999');
      expect(res.status).toBe(404);
    });
  });
});

// ─────────────────────────────────────────────────────────────────
describe('E2E: AI Chatbot Flow', () => {
  describe('Full chat journey: Create → Message → Suggestions → Archive → Delete', () => {
    let conversationId;

    beforeAll(() => { resetStoresAndSeed(); });

    test('Step 1: Create a new conversation', async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .send({ title: 'RFP Analysis Discussion' });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('RFP Analysis Discussion');
      expect(res.body.status).toBe('active');
      conversationId = res.body.id;
    });

    test('Step 2: Send first message', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/messages`)
        .send({ content: 'What are the key security requirements in the RFP?' });

      expect(res.status).toBe(200);
      expect(res.body.assistantMessage.content).toContain('analysis');
      expect(res.body.assistantMessage.sources).toBeDefined();
    });

    test('Step 3: Send follow-up message', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/messages`)
        .send({ content: 'How does the proposed solution address those requirements?' });

      expect(res.status).toBe(200);
      expect(res.body.userMessage.role).toBe('user');
      expect(res.body.assistantMessage.role).toBe('assistant');
    });

    test('Step 4: Get conversation with all messages', async () => {
      const res = await request(app).get(`/api/chat/conversations/${conversationId}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(conversationId);
      expect(res.body.messages.length).toBeGreaterThanOrEqual(4); // 2 user + 2 assistant
    });

    test('Step 5: Get suggested follow-up questions', async () => {
      const res = await request(app)
        .get(`/api/chat/conversations/${conversationId}/suggestions`);

      expect(res.status).toBe(200);
      expect(res.body.questions).toHaveLength(3);
      expect(res.body.questions[0]).toContain('compliance');
    });

    test('Step 6: List active conversations', async () => {
      // Create another conversation
      await request(app)
        .post('/api/chat/conversations')
        .send({ title: 'Budget Discussion' });

      const res = await request(app).get('/api/chat/conversations');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    test('Step 7: Archive a conversation', async () => {
      const res = await request(app)
        .put(`/api/chat/conversations/${conversationId}/archive`);

      expect(res.status).toBe(200);
      const conv = chatConversations.find((c) => c.id === conversationId);
      expect(conv.status).toBe('archived');
    });

    test('Step 8: Archived conversations excluded from default listing', async () => {
      const res = await request(app).get('/api/chat/conversations');

      expect(res.status).toBe(200);
      // Only 1 active conversation should remain
      expect(res.body.data.length).toBe(1);
    });

    test('Step 9: List archived conversations explicitly', async () => {
      const res = await request(app).get('/api/chat/conversations?status=archived');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].status).toBe('archived');
    });

    test('Step 10: Delete conversation and its messages', async () => {
      const res = await request(app).delete(`/api/chat/conversations/${conversationId}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');
      // Messages for this conversation should be removed
      expect(chatMessages.filter((m) => m.conversationId === conversationId)).toHaveLength(0);
    });
  });

  // ── Chat edge cases ────────────────────────────────────────────
  describe('Chat edge cases', () => {
    beforeEach(() => { resetStoresAndSeed(); });
    test('rejects empty message', async () => {
      const conv = await request(app)
        .post('/api/chat/conversations')
        .send({});

      const res = await request(app)
        .post(`/api/chat/conversations/${conv.body.id}/messages`)
        .send({ content: '' });

      expect(res.status).toBe(400);
    });

    test('404 for message to non-existent conversation', async () => {
      const res = await request(app)
        .post('/api/chat/conversations/9999/messages')
        .send({ content: 'Hello' });

      expect(res.status).toBe(404);
    });

    test('404 for suggestions on non-existent conversation', async () => {
      const res = await request(app)
        .get('/api/chat/conversations/9999/suggestions');

      expect(res.status).toBe(404);
    });

    test('default conversation title is New Conversation', async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('New Conversation');
    });
  });
});
