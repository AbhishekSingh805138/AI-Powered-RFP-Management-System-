/**
 * E2E Test: Document Analysis Pipeline (Phase 2)
 *
 * Simulates the full document pipeline as a real user would:
 *   Upload PDF → Extract requirements → Generate proposal →
 *   View proposals → Edit proposal → Index for search →
 *   Semantic search → Run compliance check → Export proposal
 */

const request = require('supertest');
const { createMockExtractedData, createMockProposalContent } = require('../helpers/mockFactories');

// ── In-memory stores ──────────────────────────────────────────────
let rfpDocuments = [];
let generatedProposals = [];
let autoId = 1;

const mockExtractedData = createMockExtractedData();
const mockProposalContent = createMockProposalContent();

const mockModels = {
  RfpDocument: {
    create: jest.fn(async (data) => {
      const doc = {
        id: autoId++, ...data, generatedProposals: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        update: jest.fn(async function (u) { Object.assign(this, u); return this; }),
        destroy: jest.fn(async function () { rfpDocuments = rfpDocuments.filter((d) => d.id !== this.id); }),
        toJSON: function () { const { update, destroy, toJSON, ...rest } = this; return rest; },
      };
      rfpDocuments.push(doc);
      return doc;
    }),
    findAll: jest.fn(async () => rfpDocuments),
    findAndCountAll: jest.fn(async ({ limit, offset } = {}) => ({
      count: rfpDocuments.length,
      rows: rfpDocuments.slice(offset || 0, (offset || 0) + (limit || 20)),
    })),
    findByPk: jest.fn(async (id) => rfpDocuments.find((d) => d.id === parseInt(id, 10)) || null),
  },
  GeneratedProposal: {
    create: jest.fn(async (data) => {
      const gp = {
        id: autoId++, ...data,
        version: data.version || 1,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        update: jest.fn(async function (u) { Object.assign(this, u); return this; }),
        destroy: jest.fn(),
        toJSON: function () { const { update, destroy, toJSON, ...rest } = this; return rest; },
      };
      generatedProposals.push(gp);
      // Attach to parent document
      const doc = rfpDocuments.find((d) => d.id === gp.rfpDocumentId);
      if (doc) doc.generatedProposals.push(gp);
      return gp;
    }),
    findAll: jest.fn(async ({ where } = {}) => {
      let filtered = [...generatedProposals];
      if (where?.rfpDocumentId) filtered = filtered.filter((p) => p.rfpDocumentId === parseInt(where.rfpDocumentId, 10));
      return filtered;
    }),
    findByPk: jest.fn(async (id) => generatedProposals.find((p) => p.id === parseInt(id, 10)) || null),
    findOne: jest.fn(async ({ where } = {}) => {
      if (!where) return null;
      return generatedProposals.find((p) =>
        (!where.id || p.id === parseInt(where.id, 10)) &&
        (!where.rfpDocumentId || p.rfpDocumentId === parseInt(where.rfpDocumentId, 10))
      ) || null;
    }),
    count: jest.fn(async ({ where } = {}) => {
      let filtered = [...generatedProposals];
      if (where?.rfpDocumentId) filtered = filtered.filter((p) => p.rfpDocumentId === where.rfpDocumentId);
      return filtered.length;
    }),
    destroy: jest.fn(async () => {}),
  },
  Rfp: { findAll: jest.fn(async () => []), findByPk: jest.fn(async () => null) },
  Proposal: { findAll: jest.fn(async () => []), findByPk: jest.fn(async () => null) },
  User: {
    findByPk: jest.fn(async () => ({ id: 1, email: 'admin@test.com', role: 'admin', status: 'active' })),
  },
  sequelize: { authenticate: jest.fn(), sync: jest.fn(), close: jest.fn() },
};

const mockAiService = {
  extractRequirements: jest.fn().mockResolvedValue(mockExtractedData),
  generateProposal: jest.fn().mockResolvedValue(mockProposalContent),
  parseRfpFromNaturalLanguage: jest.fn(),
  parseVendorProposal: jest.fn(),
  compareProposals: jest.fn(),
};

const mockEmbeddingService = {
  indexDocument: jest.fn().mockResolvedValue({ indexed: 5, chunks: 5 }),
  semanticSearch: jest.fn(),
  getIndexStats: jest.fn().mockResolvedValue({
    totalChunks: 25,
    byType: [
      { sourceType: 'rfp_document', count: 15 },
      { sourceType: 'generated_proposal', count: 10 },
    ],
  }),
};

const mockSearchService = {
  ragSearch: jest.fn().mockResolvedValue({
    answer: 'Based on the RFP, OAuth 2.0 authentication with SAML SSO is required.',
    sources: [
      { sourceType: 'rfp_document', sourceId: 1, sourceTitle: 'Enterprise Software RFP', topSimilarity: 0.95 },
    ],
    chunks: [
      { chunkText: 'Must implement OAuth 2.0 authentication with SSO support', similarity: 0.95 },
    ],
  }),
};

const mockComplianceService = {
  checkCompliance: jest.fn().mockResolvedValue({
    overall_score: 85,
    overall_status: 'mostly_compliant',
    categories: [
      { category: 'Security', score: 90, status: 'compliant', findings: [] },
      { category: 'Technical', score: 80, status: 'partially_compliant', findings: ['Missing HA details'] },
    ],
    gaps: ['High-availability architecture details not fully specified'],
    recommendations: ['Add HA failover documentation'],
  }),
};

const mockExportService = {
  generatePdf: jest.fn().mockResolvedValue(Buffer.from('fake-pdf-content')),
  generateDocx: jest.fn().mockResolvedValue(Buffer.from('fake-docx-content')),
};

jest.mock('../../src/models', () => mockModels);
jest.mock('../../src/config/database', () => ({}));
jest.mock('../../src/services/aiService', () => mockAiService);
jest.mock('../../src/services/embeddingService', () => mockEmbeddingService);
jest.mock('../../src/services/searchService', () => mockSearchService);
jest.mock('../../src/services/complianceService', () => mockComplianceService);
jest.mock('../../src/services/exportService', () => mockExportService);
jest.mock('../../src/services/notificationService', () => ({ sendNotification: jest.fn() }));
jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 1, email: 'manager@test.com', role: 'manager' };
    next();
  },
  requireRole: () => (req, res, next) => next(),
}));
jest.mock('pdf-parse', () => jest.fn().mockResolvedValue({
  text: 'Enterprise Software Development RFP. Requirements include OAuth 2.0, PostgreSQL replication, SOC 2 compliance.',
  numpages: 5,
}));

const { createApp } = require('../../src/app');

let app;

beforeAll(() => { app = createApp(); });

function resetStores() {
  rfpDocuments = [];
  generatedProposals = [];
  autoId = 1;
}

function resetMocks() {
  jest.clearAllMocks();
  mockAiService.extractRequirements.mockResolvedValue(mockExtractedData);
  mockAiService.generateProposal.mockResolvedValue(mockProposalContent);
}

// ─────────────────────────────────────────────────────────────────
describe('E2E: Document Analysis Pipeline', () => {
  describe('Full journey: Upload → Extract → Generate → Search → Compliance → Export', () => {
    let documentId, proposalId;

    beforeAll(() => { resetStores(); resetMocks(); });

    test('Step 1: Upload an RFP PDF document', async () => {
      const res = await request(app)
        .post('/api/rfp-documents/upload')
        .attach('file', Buffer.from('%PDF-1.4 Enterprise Software Development RFP document content'), {
          filename: 'enterprise-software-rfp.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(201);
      expect(res.body.originalFilename).toBe('enterprise-software-rfp.pdf');
      expect(res.body.status).toBe('uploaded');
      documentId = res.body.id;
    });

    test('Step 2: Extract requirements using AI', async () => {
      const res = await request(app)
        .post(`/api/rfp-documents/${documentId}/extract`);

      expect(res.status).toBe(200);
      const doc = rfpDocuments.find((d) => d.id === documentId);
      expect(doc.status).toBe('extracted');
      expect(doc.extractedData.technical_requirements).toHaveLength(2);
      expect(doc.extractedData.compliance_requirements).toHaveLength(1);
      expect(doc.title).toBe('Enterprise Software Development RFP');
    });

    test('Step 3: List documents — verify extracted document appears', async () => {
      const res = await request(app).get('/api/rfp-documents');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].status).toBe('extracted');
    });

    test('Step 4: Get document details', async () => {
      const res = await request(app).get(`/api/rfp-documents/${documentId}`);

      expect(res.status).toBe(200);
      expect(res.body.extractedData.budget_info.estimated_budget).toBe(500000);
      expect(res.body.extractedData.evaluation_criteria).toHaveLength(3);
    });

    test('Step 5: Generate proposal based on extracted requirements', async () => {
      const res = await request(app)
        .post(`/api/rfp-documents/${documentId}/generate`)
        .send({
          companyProfile: {
            company_name: 'TechWorks Inc',
            industry: 'Enterprise Software',
            expertise: 'Cloud-native development',
            years_of_experience: 12,
            team_size: 40,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.rfpDocumentId).toBe(documentId);
      expect(res.body.status).toBe('generated');
      proposalId = res.body.id;
    });

    test('Step 6: List generated proposals for this document', async () => {
      const res = await request(app)
        .get(`/api/rfp-documents/${documentId}/proposals`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    test('Step 7: Get generated proposal details', async () => {
      const gp = generatedProposals.find((p) => p.id === proposalId);
      const doc = rfpDocuments.find((d) => d.id === gp.rfpDocumentId);
      mockModels.GeneratedProposal.findOne.mockResolvedValue({
        ...gp,
        rfpDocument: { id: doc.id, userId: doc.userId },
      });

      const res = await request(app)
        .get(`/api/rfp-documents/${documentId}/proposals/${proposalId}`);

      expect(res.status).toBe(200);
      expect(res.body.proposalContent.executive_summary).toBeDefined();
      expect(res.body.proposalContent.cost_breakdown).toBeDefined();
    });

    test('Step 8: Edit the generated proposal', async () => {
      const gp = generatedProposals.find((p) => p.id === proposalId);
      const doc = rfpDocuments.find((d) => d.id === gp.rfpDocumentId);
      mockModels.GeneratedProposal.findOne.mockResolvedValue({
        ...gp,
        rfpDocument: { id: doc.id, userId: doc.userId },
        update: jest.fn(async function (u) { Object.assign(this, u); return this; }),
      });

      const updatedContent = {
        ...mockProposalContent,
        executive_summary: 'Updated: We deliver cloud-native enterprise solutions with proven track record.',
      };

      const res = await request(app)
        .put(`/api/rfp-documents/${documentId}/proposals/${proposalId}`)
        .send({ proposalContent: updatedContent, status: 'edited' });

      expect(res.status).toBe(200);
    });

    test('Step 9: Index document for semantic search', async () => {
      const res = await request(app)
        .post(`/api/search/index/rfp_document/${documentId}`);

      expect(res.status).toBe(200);
      expect(res.body.indexed).toBe(5);
      expect(mockEmbeddingService.indexDocument).toHaveBeenCalledWith(
        'rfp_document', documentId,
        expect.any(String),
        expect.any(String),
        expect.any(Object)
      );
    });

    test('Step 10: Perform semantic search', async () => {
      const res = await request(app)
        .post('/api/search')
        .send({ query: 'What authentication methods are required?' });

      expect(res.status).toBe(200);
      expect(res.body.answer).toContain('OAuth 2.0');
      expect(res.body.sources).toHaveLength(1);
      expect(res.body.sources[0].sourceType).toBe('rfp_document');
    });

    test('Step 11: Run compliance check', async () => {
      const res = await request(app)
        .post('/api/compliance/check')
        .send({
          rfpDocumentId: documentId,
          generatedProposalId: proposalId,
        });

      expect(res.status).toBe(200);
      expect(res.body.overall_score).toBe(85);
      expect(res.body.overall_status).toBe('mostly_compliant');
      expect(res.body.gaps).toHaveLength(1);
      expect(res.body.recommendations).toHaveLength(1);
    });

    test('Step 12: Check search index statistics', async () => {
      const res = await request(app).get('/api/search/stats');

      expect(res.status).toBe(200);
      expect(res.body.totalChunks).toBe(25);
      expect(res.body.byType).toHaveLength(2);
    });

    test('Step 13: Export proposal as PDF', async () => {
      const gp = generatedProposals.find((p) => p.id === proposalId);
      const doc = rfpDocuments.find((d) => d.id === gp.rfpDocumentId);
      mockModels.GeneratedProposal.findOne.mockResolvedValue({
        ...gp,
        rfpDocument: { id: doc.id, userId: doc.userId },
      });

      const res = await request(app)
        .get(`/api/rfp-documents/${documentId}/proposals/${proposalId}/export?format=pdf`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(mockExportService.generatePdf).toHaveBeenCalled();
    });

    test('Step 14: Export proposal as DOCX', async () => {
      const gp = generatedProposals.find((p) => p.id === proposalId);
      const doc = rfpDocuments.find((d) => d.id === gp.rfpDocumentId);
      mockModels.GeneratedProposal.findOne.mockResolvedValue({
        ...gp,
        rfpDocument: { id: doc.id, userId: doc.userId },
      });

      const res = await request(app)
        .get(`/api/rfp-documents/${documentId}/proposals/${proposalId}/export?format=docx`);

      expect(res.status).toBe(200);
      expect(mockExportService.generateDocx).toHaveBeenCalled();
    });

    test('Step 15: Delete the document', async () => {
      const res = await request(app).delete(`/api/rfp-documents/${documentId}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');
    });
  });

  // ── Index-all across phases ────────────────────────────────────
  describe('Index-all: bulk indexing across document types', () => {
    beforeEach(() => { resetStores(); resetMocks(); });
    test('indexes all document types from all phases', async () => {
      mockModels.RfpDocument.findAll.mockResolvedValueOnce([
        { id: 1, rawText: 'RFP doc text', title: 'Doc 1', originalFilename: 'doc.pdf', status: 'extracted' },
      ]);
      mockModels.GeneratedProposal.findAll.mockResolvedValueOnce([
        { id: 1, proposalContent: mockProposalContent, title: 'Proposal v1', version: 1, rfpDocumentId: 1 },
      ]);
      mockModels.Proposal.findAll.mockResolvedValueOnce([
        { id: 1, rawContent: 'Vendor proposal', parsedData: { items: [] }, rfpId: 1, vendorId: 1, status: 'parsed' },
      ]);
      mockModels.Rfp.findAll.mockResolvedValueOnce([
        { id: 1, rawInput: 'Laptop RFP', structuredData: { items: [] }, title: 'Laptop RFP', status: 'sent' },
      ]);

      const res = await request(app).post('/api/search/index-all');

      expect(res.status).toBe(200);
      expect(res.body.details.rfp_documents).toBe(1);
      expect(res.body.details.generated_proposals).toBe(1);
      expect(res.body.details.proposals).toBe(1);
      expect(res.body.details.rfps).toBe(1);
      expect(res.body.indexed).toBe(4);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────
  describe('Document pipeline edge cases', () => {
    beforeEach(() => { resetStores(); resetMocks(); });
    test('extract on non-existent document returns 404', async () => {
      const res = await request(app).post('/api/rfp-documents/999/extract');
      expect(res.status).toBe(404);
    });

    test('generate proposal on un-extracted document is rejected', async () => {
      // Create a document that hasn't been extracted yet
      const upload = await request(app)
        .post('/api/rfp-documents/upload')
        .attach('file', Buffer.from('%PDF-1.4 unextracted doc'), {
          filename: 'unextracted.pdf',
          contentType: 'application/pdf',
        });
      const docId = upload.body.id;

      // Ensure extractedData is null (uploaded but not extracted)
      const doc = rfpDocuments.find((d) => d.id === docId);
      doc.extractedData = null;

      const res = await request(app)
        .post(`/api/rfp-documents/${docId}/generate`)
        .send({
          companyProfile: { company_name: 'Test', industry: 'IT', expertise: 'Dev', years_of_experience: 5, team_size: 10 },
        });

      expect(res.status).toBe(400);
    });

    test('index with invalid sourceType returns 400', async () => {
      const res = await request(app).post('/api/search/index/invalid_type/1');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid sourceType');
    });

    test('index with invalid sourceId returns 400', async () => {
      const res = await request(app).post('/api/search/index/rfp_document/abc');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid sourceId');
    });

    test('search with empty query returns 400', async () => {
      const res = await request(app)
        .post('/api/search')
        .send({ query: '' });

      expect(res.status).toBe(400);
    });

    test('AI extraction failure updates document status to error', async () => {
      mockAiService.extractRequirements.mockRejectedValueOnce(new Error('OpenAI rate limit'));

      const upload = await request(app)
        .post('/api/rfp-documents/upload')
        .attach('file', Buffer.from('%PDF-1.4 error test'), {
          filename: 'fail-test.pdf',
          contentType: 'application/pdf',
        });

      const res = await request(app)
        .post(`/api/rfp-documents/${upload.body.id}/extract`);

      expect(res.status).toBe(500);
      const doc = rfpDocuments.find((d) => d.id === upload.body.id);
      expect(doc.status).toBe('error');
    });
  });
});
