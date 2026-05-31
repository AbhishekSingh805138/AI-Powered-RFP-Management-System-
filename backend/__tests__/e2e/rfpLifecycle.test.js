/**
 * E2E Test: RFP Complete Lifecycle (Phase 1)
 *
 * Simulates the full RFP workflow as a real user would:
 *   Create RFP (AI-parsed) → List RFPs → Get details → Update status →
 *   Create vendors → Send RFP to vendors → Add manual proposal →
 *   Upload PDF proposal → Parse proposals with AI → Compare proposals →
 *   Delete RFP
 */

const request = require('supertest');

// ── In-memory stores ──────────────────────────────────────────────
let rfps = [];
let vendors = [];
let proposals = [];
let comparisons = [];
let rfpVendors = [];
let autoId = 1;

const mockModels = {
  Rfp: {
    create: jest.fn(async (data) => {
      const rfp = {
        id: autoId++, ...data, vendors: [], proposals: [], comparisons: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        update: jest.fn(async function (u) { Object.assign(this, u); return this; }),
        destroy: jest.fn(async function () { rfps = rfps.filter((r) => r.id !== this.id); }),
      };
      rfps.push(rfp);
      return rfp;
    }),
    findAll: jest.fn(async () => rfps),
    findAndCountAll: jest.fn(async ({ where, limit, offset } = {}) => {
      let filtered = [...rfps];
      if (where?.userId) filtered = filtered.filter((r) => r.userId === where.userId);
      return { count: filtered.length, rows: filtered.slice(offset || 0, (offset || 0) + (limit || 20)) };
    }),
    findByPk: jest.fn(async (id, opts) => {
      const rfp = rfps.find((r) => r.id === parseInt(id, 10));
      if (!rfp) return null;
      // Attach related data (shallow copies to avoid circular refs)
      rfp.vendors = vendors.filter((v) => rfpVendors.some((rv) => rv.rfpId === rfp.id && rv.vendorId === v.id))
        .map((v) => ({ id: v.id, name: v.name, email: v.email, company: v.company }));
      rfp.proposals = proposals.filter((p) => p.rfpId === rfp.id)
        .map((p) => ({ id: p.id, vendorId: p.vendorId, status: p.status, totalPrice: p.totalPrice, parsedData: p.parsedData, rawContent: p.rawContent,
          vendor: vendors.find((v) => v.id === p.vendorId) ? { id: p.vendorId, name: vendors.find((v) => v.id === p.vendorId)?.name } : null,
          update: p.update }));
      rfp.comparisons = comparisons.filter((c) => c.rfpId === rfp.id);
      return rfp;
    }),
  },
  Vendor: {
    create: jest.fn(async (data) => {
      const v = {
        id: autoId++, ...data,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        update: jest.fn(async function (u) { Object.assign(this, u); return this; }),
        destroy: jest.fn(async function () { vendors = vendors.filter((x) => x.id !== this.id); }),
      };
      vendors.push(v);
      return v;
    }),
    findAll: jest.fn(async ({ where } = {}) => {
      if (where?.id) return vendors.filter((v) => where.id.includes(v.id));
      return vendors;
    }),
    findAndCountAll: jest.fn(async ({ limit, offset } = {}) => {
      return { count: vendors.length, rows: vendors.slice(offset || 0, (offset || 0) + (limit || 20)) };
    }),
    findByPk: jest.fn(async (id) => vendors.find((v) => v.id === parseInt(id, 10)) || null),
    findOne: jest.fn(async ({ where }) => vendors.find((v) => v.email === where.email) || null),
  },
  Proposal: {
    create: jest.fn(async (data) => {
      const p = {
        id: autoId++, ...data,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        update: jest.fn(async function (u) { Object.assign(this, u); return this; }),
        destroy: jest.fn(),
      };
      proposals.push(p);
      return p;
    }),
    findAll: jest.fn(async () => proposals),
    findAndCountAll: jest.fn(async ({ where, limit, offset } = {}) => {
      let filtered = [...proposals];
      if (where?.rfpId) filtered = filtered.filter((p) => p.rfpId === where.rfpId);
      return { count: filtered.length, rows: filtered.slice(offset || 0, (offset || 0) + (limit || 20)) };
    }),
    findByPk: jest.fn(async (id, opts) => {
      const p = proposals.find((x) => x.id === parseInt(id, 10));
      if (!p) return null;
      // Return shallow copies to avoid circular references
      const rfp = rfps.find((r) => r.id === p.rfpId);
      if (rfp) {
        p.rfp = { id: rfp.id, title: rfp.title, rawInput: rfp.rawInput, structuredData: rfp.structuredData, userId: rfp.userId, status: rfp.status };
      }
      const vendor = vendors.find((v) => v.id === p.vendorId);
      if (vendor) {
        p.vendor = { id: vendor.id, name: vendor.name, email: vendor.email, company: vendor.company };
      }
      return p;
    }),
    update: jest.fn(async ({ score }, { where }) => {
      const p = proposals.find((x) => x.rfpId === where.rfpId && x.vendorId === where.vendorId);
      if (p) p.score = score;
    }),
  },
  Comparison: {
    create: jest.fn(async (data) => {
      const c = { id: autoId++, ...data, createdAt: new Date().toISOString() };
      comparisons.push(c);
      return c;
    }),
  },
  RfpVendor: {
    findOrCreate: jest.fn(async ({ where, defaults }) => {
      let link = rfpVendors.find((rv) => rv.rfpId === where.rfpId && rv.vendorId === where.vendorId);
      if (!link) {
        link = {
          rfpId: where.rfpId, vendorId: where.vendorId, ...defaults,
          update: jest.fn(async function (u) { Object.assign(this, u); }),
        };
        rfpVendors.push(link);
        return [link, true];
      }
      link.update = jest.fn(async function (u) { Object.assign(this, u); });
      return [link, false];
    }),
  },
  User: {
    findByPk: jest.fn(async () => ({ id: 1, email: 'admin@test.com', firstName: 'Admin', role: 'admin', status: 'active' })),
  },
  sequelize: { authenticate: jest.fn(), sync: jest.fn(), close: jest.fn() },
};

const mockAiService = {
  parseRfpFromNaturalLanguage: jest.fn(),
  parseVendorProposal: jest.fn(),
  compareProposals: jest.fn(),
  extractRequirements: jest.fn(),
  generateProposal: jest.fn(),
};

jest.mock('../../src/models', () => mockModels);
jest.mock('../../src/config/database', () => ({}));
jest.mock('../../src/services/aiService', () => mockAiService);
jest.mock('../../src/services/emailService', () => ({
  sendRfpEmail: jest.fn().mockResolvedValue({ success: true }),
  fetchInboundEmails: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../src/services/notificationService', () => ({
  sendNotification: jest.fn().mockResolvedValue({}),
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
    req.user = { id: 1, email: 'admin@test.com', role: 'admin' };
    next();
  },
  requireRole: () => (req, res, next) => next(),
}));
jest.mock('pdf-parse', () => jest.fn().mockResolvedValue({ text: 'Extracted PDF text for proposal' }));

const { createApp } = require('../../src/app');

let app;

beforeAll(() => { app = createApp(); });

function resetStores() {
  rfps = [];
  vendors = [];
  proposals = [];
  comparisons = [];
  rfpVendors = [];
  autoId = 1;
}

function resetMocks() {
  jest.clearAllMocks();
}

// ─────────────────────────────────────────────────────────────────
describe('E2E: RFP Complete Lifecycle', () => {
  describe('Full journey: Create RFP → Vendors → Send → Proposals → Compare', () => {
    let rfpId, vendor1Id, vendor2Id, proposal1Id, proposal2Id;

    beforeAll(() => { resetStores(); resetMocks(); });

    test('Step 1: Create RFP via AI natural language parsing', async () => {
      mockAiService.parseRfpFromNaturalLanguage.mockResolvedValue({
        title: 'Office Laptop Procurement',
        items: [{ name: 'Business Laptop', quantity: 100, specifications: '16GB RAM, 512GB SSD' }],
        budget: { total: 150000, currency: 'USD' },
        timeline: { deliveryDays: 30 },
      });

      const res = await request(app)
        .post('/api/rfps')
        .send({ rawInput: 'We need 100 business laptops with 16GB RAM and 512GB SSD. Budget is $150,000. Delivery within 30 days.' });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Office Laptop Procurement');
      expect(res.body.status).toBe('draft');
      expect(res.body.budget).toBe(150000);
      rfpId = res.body.id;
    });

    test('Step 2: Create two vendors', async () => {
      const v1Res = await request(app)
        .post('/api/vendors')
        .send({ name: 'Dell Direct', email: 'sales@dell.test', company: 'Dell Technologies', phone: '555-0001', category: 'IT' });

      expect(v1Res.status).toBe(201);
      vendor1Id = v1Res.body.id;

      const v2Res = await request(app)
        .post('/api/vendors')
        .send({ name: 'HP Enterprise', email: 'sales@hp.test', company: 'HP Inc', phone: '555-0002', category: 'IT' });

      expect(v2Res.status).toBe(201);
      vendor2Id = v2Res.body.id;
    });

    test('Step 3: List RFPs — should show the created RFP', async () => {
      const res = await request(app).get('/api/rfps');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.total).toBe(1);
      expect(res.body.data[0].title).toBe('Office Laptop Procurement');
    });

    test('Step 4: Get RFP details with related data', async () => {
      const res = await request(app).get(`/api/rfps/${rfpId}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(rfpId);
      expect(res.body.structuredData.items).toHaveLength(1);
    });

    test('Step 5: Update RFP status to published', async () => {
      const res = await request(app)
        .put(`/api/rfps/${rfpId}`)
        .send({ status: 'published', title: 'Office Laptop Procurement 2026' });

      expect(res.status).toBe(200);
      const rfp = rfps.find((r) => r.id === rfpId);
      expect(rfp.status).toBe('published');
    });

    test('Step 6: Send RFP to vendors', async () => {
      const res = await request(app)
        .post(`/api/rfps/${rfpId}/send`)
        .send({ vendorIds: [vendor1Id, vendor2Id] });

      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(2);
      expect(res.body.results.every((r) => r.status === 'sent')).toBe(true);

      // RFP status should be updated to 'sent'
      const rfp = rfps.find((r) => r.id === rfpId);
      expect(rfp.status).toBe('sent');
    });

    test('Step 7: Add manual proposal from vendor 1', async () => {
      const res = await request(app)
        .post('/api/proposals/manual')
        .send({
          rfpId,
          vendorId: vendor1Id,
          rawContent: 'We offer 100 Dell Latitude 5550 laptops at $1,200 each. Total: $120,000. Delivery: 15 business days. 3-year warranty included.',
          sourceType: 'manual',
        });

      expect(res.status).toBe(201);
      expect(res.body.rfpId).toBe(rfpId);
      expect(res.body.status).toBe('received');
      proposal1Id = res.body.id;
    });

    test('Step 8: Upload PDF proposal from vendor 2', async () => {
      const res = await request(app)
        .post('/api/proposals/upload')
        .field('rfpId', rfpId)
        .field('vendorId', vendor2Id)
        .attach('file', Buffer.from('%PDF-1.4 HP proposal document'), {
          filename: 'hp-proposal.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(201);
      expect(res.body.sourceType).toBe('pdf');
      proposal2Id = res.body.id;
    });

    test('Step 9: List proposals for this RFP', async () => {
      const res = await request(app).get(`/api/proposals?rfpId=${rfpId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    test('Step 10: Parse proposal 1 with AI', async () => {
      mockAiService.parseVendorProposal.mockResolvedValue({
        vendorName: 'Dell Direct',
        items: [{ name: 'Dell Latitude 5550', quantity: 100, unitPrice: 1200 }],
        totalPrice: 120000,
        deliveryTimeline: '15 business days',
        warranty: '3 years',
        strengths: ['Competitive pricing', 'Fast delivery'],
      });

      const res = await request(app).post(`/api/proposals/${proposal1Id}/parse`);

      expect(res.status).toBe(200);
      const p = proposals.find((x) => x.id === proposal1Id);
      expect(p.status).toBe('parsed');
      expect(p.totalPrice).toBe(120000);
    });

    test('Step 11: Parse proposal 2 with AI', async () => {
      mockAiService.parseVendorProposal.mockResolvedValue({
        vendorName: 'HP Enterprise',
        items: [{ name: 'HP EliteBook 840 G10', quantity: 100, unitPrice: 1350 }],
        totalPrice: 135000,
        deliveryTimeline: '20 business days',
        warranty: '5 years',
        strengths: ['Extended warranty', 'Enterprise support'],
      });

      const res = await request(app).post(`/api/proposals/${proposal2Id}/parse`);

      expect(res.status).toBe(200);
      const p = proposals.find((x) => x.id === proposal2Id);
      expect(p.status).toBe('parsed');
      expect(p.totalPrice).toBe(135000);
    });

    test('Step 12: Compare proposals with AI', async () => {
      // Ensure proposals have parsed status for comparison
      proposals.forEach((p) => { p.status = 'parsed'; p.parsedData = { items: [] }; });

      mockAiService.compareProposals.mockResolvedValue({
        vendorScores: [
          { vendorId: vendor1Id, totalScore: 85, priceScore: 90, qualityScore: 80 },
          { vendorId: vendor2Id, totalScore: 78, priceScore: 70, qualityScore: 88 },
        ],
        recommendation: 'Dell Direct offers better value with competitive pricing.',
        summary: 'Both vendors meet requirements. Dell leads on price; HP leads on warranty.',
      });

      const res = await request(app).post(`/api/rfps/${rfpId}/compare`);

      expect(res.status).toBe(200);
      expect(res.body.comparison).toBeDefined();
      expect(res.body.fullResult.vendorScores).toHaveLength(2);
      expect(res.body.fullResult.recommendation).toContain('Dell');

      // Verify RFP status updated to evaluating
      const rfp = rfps.find((r) => r.id === rfpId);
      expect(rfp.status).toBe('evaluating');
    });

    test('Step 13: Get individual proposal details', async () => {
      const res = await request(app).get(`/api/proposals/${proposal1Id}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(proposal1Id);
      expect(res.body.rfp).toBeDefined();
      expect(res.body.vendor).toBeDefined();
    });

    test('Step 14: Delete the RFP', async () => {
      const res = await request(app).delete(`/api/rfps/${rfpId}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');
      expect(rfps.find((r) => r.id === rfpId)).toBeUndefined();
    });
  });

  // ── Vendor CRUD ────────────────────────────────────────────────
  describe('Vendor management', () => {
    beforeEach(() => { resetStores(); resetMocks(); });
    test('full CRUD cycle: create → list → get → update → delete', async () => {
      // Create
      const createRes = await request(app)
        .post('/api/vendors')
        .send({ name: 'Acme Corp', email: 'info@acme.test', company: 'Acme', category: 'Services' });
      expect(createRes.status).toBe(201);
      const vendorId = createRes.body.id;

      // List
      const listRes = await request(app).get('/api/vendors');
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

      // Get
      const getRes = await request(app).get(`/api/vendors/${vendorId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.name).toBe('Acme Corp');

      // Update
      const vendor = vendors.find((v) => v.id === vendorId);
      const updateRes = await request(app)
        .put(`/api/vendors/${vendorId}`)
        .send({ name: 'Acme Corporation', phone: '555-9999' });
      expect(updateRes.status).toBe(200);

      // Delete
      const deleteRes = await request(app).delete(`/api/vendors/${vendorId}`);
      expect(deleteRes.status).toBe(200);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────
  describe('RFP edge cases', () => {
    beforeEach(() => { resetStores(); resetMocks(); });
    test('404 for non-existent RFP', async () => {
      const res = await request(app).get('/api/rfps/99999');
      expect(res.status).toBe(404);
    });

    test('compare fails with fewer than 2 parsed proposals', async () => {
      mockAiService.parseRfpFromNaturalLanguage.mockResolvedValue({ title: 'Test', budget: {} });
      const createRes = await request(app)
        .post('/api/rfps')
        .send({ rawInput: 'Test RFP for compare edge case' });
      const id = createRes.body.id;

      // No proposals exist — compare should fail
      const res = await request(app).post(`/api/rfps/${id}/compare`);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('2 parsed proposals');
    });

    test('send RFP rejects empty vendorIds', async () => {
      mockAiService.parseRfpFromNaturalLanguage.mockResolvedValue({ title: 'Test' });
      const createRes = await request(app)
        .post('/api/rfps')
        .send({ rawInput: 'Test RFP' });

      const res = await request(app)
        .post(`/api/rfps/${createRes.body.id}/send`)
        .send({ vendorIds: [] });

      expect(res.status).toBe(400);
    });

    test('send RFP rejects non-integer vendorIds', async () => {
      mockAiService.parseRfpFromNaturalLanguage.mockResolvedValue({ title: 'Test' });
      const createRes = await request(app)
        .post('/api/rfps')
        .send({ rawInput: 'Test RFP' });

      const res = await request(app)
        .post(`/api/rfps/${createRes.body.id}/send`)
        .send({ vendorIds: ['abc', null] });

      expect(res.status).toBe(400);
    });
  });
});
