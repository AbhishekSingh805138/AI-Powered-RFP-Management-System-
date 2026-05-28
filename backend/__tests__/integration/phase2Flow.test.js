/**
 * Integration tests for Phase 2 end-to-end workflow.
 * Tests the full flow: Upload RFP → Extract → Generate → Index → Search → Compliance.
 * All external dependencies (OpenAI, DB) are mocked at the service boundary.
 */

process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'rfp_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'test';

const request = require('supertest');

// In-memory state to simulate DB
let documents = [];
let generatedProposals = [];
let autoId = 1;

const mockModels = {
  RfpDocument: {
    create: jest.fn(async (data) => {
      const doc = { id: autoId++, ...data, generatedProposals: [], update: jest.fn(async function(d) { Object.assign(this, d); return this; }), destroy: jest.fn(async () => {}) };
      documents.push(doc);
      return doc;
    }),
    findAll: jest.fn(async () => documents),
    findByPk: jest.fn(async (id) => documents.find(d => d.id === parseInt(id)) || null),
  },
  GeneratedProposal: {
    create: jest.fn(async (data) => {
      const gp = { id: autoId++, ...data, update: jest.fn(async function(d) { Object.assign(this, d); return this; }), destroy: jest.fn(async () => {}) };
      generatedProposals.push(gp);
      return gp;
    }),
    findAll: jest.fn(async ({ where } = {}) => {
      if (where?.rfpDocumentId) return generatedProposals.filter(p => p.rfpDocumentId === where.rfpDocumentId);
      return generatedProposals;
    }),
    findOne: jest.fn(async ({ where } = {}) => generatedProposals.find(p => p.id === parseInt(where?.id) && p.rfpDocumentId === parseInt(where?.rfpDocumentId)) || null),
    findByPk: jest.fn(async (id) => generatedProposals.find(p => p.id === parseInt(id)) || null),
    count: jest.fn(async ({ where } = {}) => generatedProposals.filter(p => p.rfpDocumentId === where?.rfpDocumentId).length),
    destroy: jest.fn(async () => 0),
  },
  Rfp: { findAll: jest.fn(async () => []), findByPk: jest.fn(async () => null), create: jest.fn() },
  Vendor: { findAll: jest.fn(async () => []), findByPk: jest.fn(async () => null) },
  RfpVendor: {},
  Proposal: { findAll: jest.fn(async () => []), findByPk: jest.fn(async () => null) },
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

// Mock external services
const mockExtractedData = {
  title: 'Cloud Migration RFP',
  issuing_organization: 'Acme Corp',
  summary: 'Looking for cloud migration services.',
  technical_requirements: [
    { id: 'TR-1', category: 'Cloud', requirement: 'AWS expertise', priority: 'mandatory' },
    { id: 'TR-2', category: 'Security', requirement: 'SOC 2 compliance', priority: 'mandatory' },
  ],
  compliance_requirements: [{ id: 'CR-1', type: 'Certification', requirement: 'AWS Partner', mandatory: true }],
  deliverables: [{ id: 'D-1', deliverable: 'Migration plan', acceptance_criteria: 'Approved by CTO' }],
  evaluation_criteria: [{ criterion: 'Technical', weight_percentage: 50 }],
  budget_info: { estimated_budget: 300000, currency: 'USD' },
};

const mockProposalContent = {
  title: 'Cloud Migration Proposal',
  executive_summary: 'We are experts in cloud migration.',
  technical_approach: { overview: 'Lift and shift with optimization', methodology: 'Agile' },
  scope_of_work: [{ phase: 'Assessment', activities: ['Audit'], deliverables: ['Report'], duration: '2 weeks' }],
  cost_breakdown: { total_estimated_cost: '$280,000', line_items: [{ item: 'Migration', category: 'Labor', estimated_cost: '$250,000' }] },
};

const mockComplianceResult = {
  overall_score: 78,
  overall_status: 'partially_compliant',
  summary: 'Good but missing AWS certification evidence.',
  statistics: { total_requirements: 3, fully_addressed: 2, partially_addressed: 1, not_addressed: 0, risks_identified: 1 },
  technical_compliance: [],
  compliance_requirements: [],
  deliverable_compliance: [],
  budget_compliance: { status: 'within_budget' },
  timeline_compliance: { status: 'meets_deadline' },
  risks: [{ risk: 'Missing cert', severity: 'major', recommendation: 'Get certified' }],
  strengths: ['Technical expertise'],
  improvement_areas: ['Certification evidence'],
};

jest.mock('../../src/services/aiService', () => ({
  extractRequirements: jest.fn().mockResolvedValue(mockExtractedData),
  generateProposal: jest.fn().mockResolvedValue(mockProposalContent),
  parseRfpFromNaturalLanguage: jest.fn(),
  parseVendorProposal: jest.fn(),
  compareProposals: jest.fn(),
}));

jest.mock('../../src/services/embeddingService', () => ({
  indexDocument: jest.fn().mockResolvedValue({ indexed: 5, chunks: 5 }),
  semanticSearch: jest.fn(),
  getIndexStats: jest.fn().mockResolvedValue({ totalChunks: 5, byType: [] }),
}));

jest.mock('../../src/services/searchService', () => ({
  ragSearch: jest.fn().mockResolvedValue({
    answer: 'The RFP requires AWS expertise and SOC 2 compliance.',
    sources: [{ sourceType: 'rfp_document', sourceId: 1, sourceTitle: 'Cloud Migration RFP', topSimilarity: 0.95, chunkCount: 3 }],
    chunks: [{ sourceTitle: 'Cloud Migration RFP', chunkText: 'AWS expertise required', similarity: 0.95 }],
  }),
}));

jest.mock('../../src/services/complianceService', () => ({
  checkCompliance: jest.fn().mockResolvedValue(mockComplianceResult),
}));

jest.mock('../../src/services/emailService', () => ({
  sendRfpEmail: jest.fn(),
  fetchInboundEmails: jest.fn().mockResolvedValue([]),
}));

jest.mock('pdf-parse', () => jest.fn().mockResolvedValue({ text: 'This is a cloud migration RFP from Acme Corp. We need AWS migration services...' }));

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
const app = createApp();

describe('Phase 2 — End-to-End Workflow', () => {
  let documentId;
  let proposalId;

  beforeAll(() => {
    documents = [];
    generatedProposals = [];
    autoId = 1;
  });

  test('Step 1: Upload RFP PDF', async () => {
    const res = await request(app)
      .post('/api/rfp-documents/upload')
      .attach('file', Buffer.from('fake pdf content'), { filename: 'cloud-migration-rfp.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.originalFilename).toBe('cloud-migration-rfp.pdf');
    expect(res.body.status).toBe('uploaded');
    documentId = res.body.id;
    expect(documentId).toBeDefined();
  });

  test('Step 2: Extract requirements from uploaded document', async () => {
    const res = await request(app)
      .post(`/api/rfp-documents/${documentId}/extract`);

    expect(res.status).toBe(200);
    // Document should be updated to "extracted" status
    const doc = documents.find(d => d.id === documentId);
    expect(doc.status).toBe('extracted');
    expect(doc.extractedData).toBeDefined();
    expect(doc.title).toBe('Cloud Migration RFP');
  });

  test('Step 3: Generate proposal from extracted requirements', async () => {
    const res = await request(app)
      .post(`/api/rfp-documents/${documentId}/generate`)
      .send({
        companyProfile: {
          company_name: 'CloudFirst Solutions',
          industry: 'Cloud Services',
          expertise: 'AWS migration',
          years_of_experience: 10,
          team_size: 30,
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.rfpDocumentId).toBe(documentId);
    // Status is 'generated' because the mock AI resolves synchronously within the same request
    expect(res.body.status).toBe('generated');
    proposalId = res.body.id;
  });

  test('Step 4: Index the RFP document for search', async () => {
    const res = await request(app)
      .post(`/api/search/index/rfp_document/${documentId}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('indexed');
    expect(res.body.indexed).toBe(5);
  });

  test('Step 5: Semantic search across indexed documents', async () => {
    const res = await request(app)
      .post('/api/search')
      .send({ query: 'What cloud certifications are needed?' });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBeDefined();
    expect(res.body.sources.length).toBeGreaterThan(0);
    expect(res.body.chunks.length).toBeGreaterThan(0);
  });

  test('Step 6: Run compliance check on generated proposal', async () => {
    const res = await request(app)
      .post('/api/compliance/check')
      .send({
        rfpDocumentId: documentId,
        generatedProposalId: proposalId,
      });

    expect(res.status).toBe(200);
    expect(res.body.overall_score).toBe(78);
    expect(res.body.overall_status).toBe('partially_compliant');
    expect(res.body.rfpDocumentId).toBe(documentId);
    expect(res.body.generatedProposalId).toBe(proposalId);
    expect(res.body.checkedAt).toBeDefined();
  });

  test('Step 7: Edit proposal based on compliance feedback', async () => {
    // Update the proposal to address compliance gaps
    const gp = generatedProposals.find(p => p.id === proposalId);
    if (gp) {
      mockModels.GeneratedProposal.findOne.mockResolvedValue(gp);
    }

    const res = await request(app)
      .put(`/api/rfp-documents/${documentId}/proposals/${proposalId}`)
      .send({
        proposalContent: {
          ...mockProposalContent,
          executive_summary: 'Updated with AWS certification evidence.',
        },
        status: 'edited',
      });

    expect(res.status).toBe(200);
  });

  test('Step 8: Search stats reflect indexed documents', async () => {
    const res = await request(app)
      .get('/api/search/stats');

    expect(res.status).toBe(200);
    expect(res.body.totalChunks).toBeDefined();
  });
});
