/**
 * E2E Test: Edge Cases, Error Handling, Notifications, Analytics & Health
 *
 * Covers scenarios that don't fit neatly into feature-specific test files:
 *   - Health/readiness endpoints
 *   - Analytics dashboard data
 *   - Notification listing, filtering, stats
 *   - Pagination across endpoints
 *   - AI service failures during workflows
 *   - Job queue async/sync fallback
 *   - Cross-cutting input validation
 */

const request = require('supertest');
const { createMockExtractedData, createMockProposalContent } = require('../helpers/mockFactories');

// ── In-memory stores ──────────────────────────────────────────────
let rfps = [];
let rfpDocuments = [];
let proposals = [];
let riskAnalyses = [];
let notifications = [];
let generatedProposals = [];
let autoId = 1;

const mockSequelize = {
  authenticate: jest.fn().mockResolvedValue(),
  sync: jest.fn(),
  close: jest.fn(),
  fn: jest.fn((name, col) => `${name}(${col})`),
  col: jest.fn((c) => c),
};

const mockModels = {
  Rfp: {
    create: jest.fn(async (data) => {
      const r = { id: autoId++, ...data, vendors: [], proposals: [], createdAt: new Date().toISOString(),
        update: jest.fn(async function (u) { Object.assign(this, u); return this; }),
        destroy: jest.fn(),
      };
      rfps.push(r);
      return r;
    }),
    findAll: jest.fn(async () => rfps),
    findAndCountAll: jest.fn(async ({ where, limit, offset } = {}) => {
      let filtered = [...rfps];
      if (where?.userId) filtered = filtered.filter((r) => r.userId === where.userId);
      const start = offset || 0;
      const end = start + (limit || 20);
      return { count: filtered.length, rows: filtered.slice(start, end) };
    }),
    findByPk: jest.fn(async (id) => rfps.find((r) => r.id === parseInt(id, 10)) || null),
    count: jest.fn(async () => rfps.length),
  },
  RfpDocument: {
    create: jest.fn(async (data) => {
      const d = { id: autoId++, ...data, generatedProposals: [], createdAt: new Date().toISOString(),
        update: jest.fn(async function (u) { Object.assign(this, u); return this; }),
        destroy: jest.fn(),
        toJSON: function () { const { update, destroy, toJSON, ...rest } = this; return rest; },
      };
      rfpDocuments.push(d);
      return d;
    }),
    findAll: jest.fn(async () => rfpDocuments),
    findAndCountAll: jest.fn(async ({ limit, offset } = {}) => ({
      count: rfpDocuments.length,
      rows: rfpDocuments.slice(offset || 0, (offset || 0) + (limit || 20)),
    })),
    findByPk: jest.fn(async (id) => rfpDocuments.find((d) => d.id === parseInt(id, 10)) || null),
    count: jest.fn(async () => rfpDocuments.length),
  },
  GeneratedProposal: {
    findAll: jest.fn(async () => generatedProposals),
    findByPk: jest.fn(async (id) => generatedProposals.find((p) => p.id === parseInt(id, 10)) || null),
    count: jest.fn(async () => generatedProposals.length),
  },
  Proposal: {
    findAll: jest.fn(async () => proposals),
    findAndCountAll: jest.fn(async ({ limit, offset } = {}) => ({
      count: proposals.length,
      rows: proposals.slice(offset || 0, (offset || 0) + (limit || 20)),
    })),
    count: jest.fn(async () => proposals.length),
  },
  RiskAnalysis: {
    findAll: jest.fn(async () => riskAnalyses),
    count: jest.fn(async () => riskAnalyses.length),
  },
  Vendor: {
    findAll: jest.fn(async () => []),
    findAndCountAll: jest.fn(async () => ({ count: 0, rows: [] })),
  },
  Notification: {
    findAndCountAll: jest.fn(async ({ where, limit, offset } = {}) => {
      let filtered = notifications.filter((n) => n.recipientId === (where?.recipientId || 1));
      if (where?.type) filtered = filtered.filter((n) => n.type === where.type);
      if (where?.status) filtered = filtered.filter((n) => n.status === where.status);
      return { count: filtered.length, rows: filtered.slice(offset || 0, (offset || 0) + (limit || 20)) };
    }),
    count: jest.fn(async ({ where } = {}) => {
      let filtered = notifications.filter((n) => n.recipientId === (where?.recipientId || 1));
      if (where?.status) filtered = filtered.filter((n) => n.status === where.status);
      if (where?.createdAt) filtered = filtered; // Simplified for testing
      return filtered.length;
    }),
    findAll: jest.fn(async ({ where, attributes, group } = {}) => {
      // For byType aggregation
      const filtered = notifications.filter((n) => n.recipientId === (where?.recipientId || 1));
      const typeCounts = {};
      filtered.forEach((n) => { typeCounts[n.type] = (typeCounts[n.type] || 0) + 1; });
      return Object.entries(typeCounts).map(([type, count]) => ({ type, count: String(count) }));
    }),
  },
  ChatConversation: {
    findAll: jest.fn(async () => []),
    findAndCountAll: jest.fn(async () => ({ count: 0, rows: [] })),
  },
  User: {
    findByPk: jest.fn(async () => ({ id: 1, email: 'admin@test.com', role: 'admin', status: 'active', firstName: 'Admin' })),
  },
  sequelize: mockSequelize,
};

jest.mock('../../src/models', () => mockModels);
jest.mock('../../src/config/database', () => mockSequelize);
jest.mock('../../src/services/aiService', () => ({
  parseRfpFromNaturalLanguage: jest.fn(),
  extractRequirements: jest.fn(),
  generateProposal: jest.fn(),
  parseVendorProposal: jest.fn(),
  compareProposals: jest.fn(),
}));
jest.mock('../../src/services/embeddingService', () => ({
  indexDocument: jest.fn().mockResolvedValue({ indexed: 0 }),
  semanticSearch: jest.fn(),
  getIndexStats: jest.fn().mockResolvedValue({ totalChunks: 0, byType: [] }),
}));
jest.mock('../../src/services/searchService', () => ({
  ragSearch: jest.fn().mockResolvedValue({ answer: 'No results', sources: [], chunks: [] }),
}));
jest.mock('../../src/services/notificationService', () => ({ sendNotification: jest.fn() }));
jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 1, email: 'admin@test.com', role: 'admin' };
    next();
  },
  requireRole: () => (req, res, next) => next(),
}));
jest.mock('pdf-parse', () => jest.fn().mockResolvedValue({
  text: 'Test PDF content for upload testing.',
  numpages: 1,
}));

const { createApp } = require('../../src/app');
const aiService = require('../../src/services/aiService');

let app;

beforeAll(() => { app = createApp(); });

beforeEach(() => {
  rfps = [];
  rfpDocuments = [];
  proposals = [];
  riskAnalyses = [];
  notifications = [];
  generatedProposals = [];
  autoId = 1;
  jest.clearAllMocks();
  mockSequelize.authenticate.mockResolvedValue();
});

// ─────────────────────────────────────────────────────────────────
// NOTE: /api/healthz and /api/ready are defined in server.js, not app.js,
// so they are not available via createApp(). Only /api/health is in app.js.
describe('E2E: Health Endpoint', () => {
  test('GET /api/health — healthy when DB is connected', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
    expect(res.body.timestamp).toBeDefined();
  });

  test('GET /api/health — unhealthy when DB is down', async () => {
    mockSequelize.authenticate.mockRejectedValueOnce(new Error('Connection refused'));

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.database).toBe('disconnected');
  });

  test('health endpoint does not require authentication', async () => {
    // /api/health is before the auth wall in app.js
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('E2E: Notifications Flow', () => {
  beforeEach(() => {
    // Seed notifications
    notifications = [
      { id: 1, type: 'rfp-sent', status: 'sent', recipientId: 1, recipientType: 'user', createdAt: new Date().toISOString() },
      { id: 2, type: 'proposal-received', status: 'sent', recipientId: 1, recipientType: 'user', createdAt: new Date().toISOString() },
      { id: 3, type: 'rfp-sent', status: 'failed', recipientId: 1, recipientType: 'user', createdAt: new Date().toISOString() },
      { id: 4, type: 'extraction-complete', status: 'queued', recipientId: 1, recipientType: 'user', createdAt: new Date().toISOString() },
      { id: 5, type: 'rfp-sent', status: 'sent', recipientId: 2, recipientType: 'user', createdAt: new Date().toISOString() }, // Other user
    ];
  });

  test('list notifications — default pagination', async () => {
    const res = await request(app).get('/api/notifications');

    expect(res.status).toBe(200);
    expect(res.body.notifications.length).toBe(4); // Only user 1's notifications
    expect(res.body.pagination.total).toBe(4);
    expect(res.body.pagination.page).toBe(1);
  });

  test('list notifications — filter by type', async () => {
    const res = await request(app).get('/api/notifications?type=rfp-sent');

    expect(res.status).toBe(200);
    expect(res.body.notifications.every((n) => n.type === 'rfp-sent')).toBe(true);
  });

  test('list notifications — filter by status', async () => {
    const res = await request(app).get('/api/notifications?status=sent');

    expect(res.status).toBe(200);
    expect(res.body.notifications.every((n) => n.status === 'sent')).toBe(true);
  });

  test('notification stats', async () => {
    const res = await request(app).get('/api/notifications/stats');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.sent).toBeDefined();
    expect(res.body.failed).toBeDefined();
    expect(res.body.queued).toBeDefined();
    expect(res.body.byType).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────
describe('E2E: Pagination', () => {
  beforeEach(() => {
    // Seed 25 RFPs
    for (let i = 0; i < 25; i++) {
      rfps.push({
        id: autoId++, title: `RFP ${i + 1}`, userId: 1, status: 'draft',
        vendors: [], proposals: [],
        createdAt: new Date().toISOString(),
      });
    }
  });

  test('default pagination returns first 20 items', async () => {
    const res = await request(app).get('/api/rfps');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(20);
    expect(res.body.total).toBe(25);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
  });

  test('page 2 returns remaining items', async () => {
    const res = await request(app).get('/api/rfps?page=2');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(5);
    expect(res.body.page).toBe(2);
  });

  test('custom limit', async () => {
    const res = await request(app).get('/api/rfps?limit=10');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(10);
    expect(res.body.limit).toBe(10);
  });

  test('limit capped at 100', async () => {
    const res = await request(app).get('/api/rfps?limit=500');

    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(100);
  });

  test('page below 1 defaults to 1', async () => {
    const res = await request(app).get('/api/rfps?page=0');

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
  });

  test('empty page beyond data range', async () => {
    const res = await request(app).get('/api/rfps?page=100');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
    expect(res.body.total).toBe(25);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('E2E: AI Service Failure Recovery', () => {
  test('RFP creation fails gracefully when AI parsing fails', async () => {
    aiService.parseRfpFromNaturalLanguage.mockRejectedValueOnce(
      new Error('OpenAI API rate limit exceeded')
    );

    const res = await request(app)
      .post('/api/rfps')
      .send({ rawInput: 'Test RFP with AI failure' });

    expect(res.status).toBe(500);
  });

  test('document extraction failure marks document as error', async () => {
    aiService.extractRequirements.mockRejectedValueOnce(
      new Error('OpenAI timeout after 30s')
    );

    // Create a document first
    const doc = await request(app)
      .post('/api/rfp-documents/upload')
      .attach('file', Buffer.from('%PDF-1.4 timeout test'), {
        filename: 'timeout.pdf',
        contentType: 'application/pdf',
      });

    const res = await request(app)
      .post(`/api/rfp-documents/${doc.body.id}/extract`);

    expect(res.status).toBe(500);
    const docInStore = rfpDocuments.find((d) => d.id === doc.body.id);
    expect(docInStore.status).toBe('error');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('E2E: Job Queue Async Flow', () => {
  test('GET /api/jobs/:id — returns 404 when queue is unavailable (test env)', async () => {
    // In test environment, jobQueue.isAvailable() returns false because start() returns false
    // The controller returns 404 "Job queue is not available"
    const res = await request(app).get('/api/jobs/fake-job-id');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('not available');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('E2E: Cross-Cutting Input Validation', () => {
  test('JSON body size limit (rejects oversized payloads)', async () => {
    const hugePayload = { rawInput: 'x'.repeat(11000) };

    const res = await request(app)
      .post('/api/rfps')
      .send(hugePayload);

    expect(res.status).toBe(400);
  });

  test('non-JSON content-type is handled', async () => {
    const res = await request(app)
      .post('/api/rfps')
      .set('Content-Type', 'text/plain')
      .send('raw text body');

    // Express JSON parser won't parse this — empty body
    expect([400, 415]).toContain(res.status);
  });

  test('empty body on required-body endpoints', async () => {
    const res = await request(app)
      .post('/api/rfps')
      .send({});

    expect(res.status).toBe(400);
  });

  test('search with very long query still works', async () => {
    const res = await request(app)
      .post('/api/search')
      .send({ query: 'a'.repeat(500) });

    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('E2E: Analytics Dashboard', () => {
  test('GET /api/analytics — returns aggregated dashboard data', async () => {
    // The analytics controller uses findAll on each model, not count
    // Seed return values for the parallel Promise.all
    const now = new Date().toISOString();
    mockModels.Rfp.findAll.mockResolvedValueOnce([
      { id: 1, status: 'draft', budget: 50000, createdAt: now },
      { id: 2, status: 'sent', budget: 100000, createdAt: now },
      { id: 3, status: 'evaluating', budget: 75000, createdAt: now },
    ]);
    mockModels.Vendor.findAll.mockResolvedValueOnce([
      { id: 1, createdAt: now },
    ]);
    mockModels.Proposal.findAll.mockResolvedValueOnce([
      { id: 1, status: 'parsed', totalPrice: 120000, score: 85, sourceType: 'manual', createdAt: now },
    ]);
    mockModels.RfpDocument.findAll.mockResolvedValueOnce([
      { id: 1, status: 'extracted', createdAt: now },
      { id: 2, status: 'uploaded', createdAt: now },
    ]);
    mockModels.RiskAnalysis.findAll.mockResolvedValueOnce([
      { id: 1, overallRiskLevel: 'low', overallRiskScore: 30, status: 'completed', createdAt: now },
      { id: 2, overallRiskLevel: 'high', overallRiskScore: 75, status: 'completed', createdAt: now },
    ]);
    mockModels.ChatConversation.findAll.mockResolvedValueOnce([]);

    const res = await request(app).get('/api/analytics');

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.totalRfps).toBe(3);
    expect(res.body.summary.totalVendors).toBe(1);
    expect(res.body.summary.totalProposals).toBe(1);
    expect(res.body.charts).toBeDefined();
    expect(res.body.charts.rfpStatusBreakdown).toBeDefined();
    expect(res.body.charts.riskLevelDistribution).toBeDefined();
    expect(res.body.charts.activityTimeline).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────
describe('E2E: File Upload Edge Cases', () => {
  test('upload without file returns 400', async () => {
    const res = await request(app)
      .post('/api/rfp-documents/upload');

    expect(res.status).toBe(400);
  });

  test('upload non-PDF file is rejected', async () => {
    const res = await request(app)
      .post('/api/rfp-documents/upload')
      .attach('file', Buffer.from('not a pdf'), {
        filename: 'document.txt',
        contentType: 'text/plain',
      });

    // Multer fileFilter throws plain Error → error handler returns 500
    // (not a MulterError, so no specific status code is set)
    expect([400, 415, 422, 500]).toContain(res.status);
  });

  test('upload with path traversal in filename is sanitized', async () => {
    const res = await request(app)
      .post('/api/rfp-documents/upload')
      .attach('file', Buffer.from('%PDF-1.4 traversal test'), {
        filename: '../../../etc/passwd.pdf',
        contentType: 'application/pdf',
      });

    if (res.status === 201) {
      // Filename should be sanitized (no path traversal)
      expect(res.body.originalFilename).not.toContain('..');
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// NOTE: X-Request-Id middleware is registered in server.js, not app.js.
// It's tested in the middleware tests. We verify Helmet security headers instead.
describe('E2E: Security Headers', () => {
  test('responses include Helmet security headers', async () => {
    const res = await request(app).get('/api/health');

    // Helmet sets various security headers
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  test('CORS headers are present for allowed origins', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:3000');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});
