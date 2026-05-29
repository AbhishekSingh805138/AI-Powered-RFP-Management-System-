/**
 * API endpoint tests for /api/rfp-documents (Phase 2 — RFP Document Analyzer).
 */

process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'rfp_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'test';

const request = require('supertest');

// Mock all models
const mockModels = {
  RfpDocument: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  GeneratedProposal: {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    destroy: jest.fn(),
  },
  Rfp: { findAll: jest.fn(), findByPk: jest.fn() },
  Vendor: { findAll: jest.fn(), findByPk: jest.fn() },
  RfpVendor: {},
  Proposal: { findAll: jest.fn(), findByPk: jest.fn() },
  Comparison: {},
  DocumentEmbedding: {},
  RiskAnalysis: { create: jest.fn(), findByPk: jest.fn(), findAll: jest.fn() },
  ChatConversation: { create: jest.fn(), findByPk: jest.fn(), findAll: jest.fn(), update: jest.fn() },
  ChatMessage: { create: jest.fn(), findAll: jest.fn(), count: jest.fn(), destroy: jest.fn() },
  User: { findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn(), scope: jest.fn() },
  sequelize: { authenticate: jest.fn(), sync: jest.fn(), close: jest.fn() },
};
jest.mock('../../src/models', () => mockModels);
jest.mock('../../src/config/database', () => ({}));

// Mock aiService
const mockAiService = {
  extractRequirements: jest.fn(),
  generateProposal: jest.fn(),
  parseRfpFromNaturalLanguage: jest.fn(),
  parseVendorProposal: jest.fn(),
  compareProposals: jest.fn(),
};
jest.mock('../../src/services/aiService', () => mockAiService);

// Mock pdf-parse
jest.mock('pdf-parse', () => {
  return jest.fn().mockResolvedValue({ text: 'Extracted PDF text content for testing.' });
});

// Mock exportService
const mockExportService = {
  generatePdf: jest.fn(),
  generateDocx: jest.fn(),
};
jest.mock('../../src/services/exportService', () => mockExportService);

// Mock email service (required by rfpController)
jest.mock('../../src/services/emailService', () => ({
  sendRfpEmail: jest.fn(),
  fetchInboundEmails: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../src/services/embeddingService', () => ({
  indexDocument: jest.fn(),
  getIndexStats: jest.fn(),
}));
jest.mock('../../src/services/searchService', () => ({
  ragSearch: jest.fn(),
}));
jest.mock('../../src/services/complianceService', () => ({
  checkCompliance: jest.fn(),
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
  createMockExtractedData,
  createMockGeneratedProposal,
  createMockProposalContent,
} = require('../helpers/mockFactories');

const app = createApp();

describe('POST /api/rfp-documents/upload', () => {
  beforeEach(() => jest.clearAllMocks());

  test('201 — uploads a PDF and creates document record', async () => {
    const mockDoc = createMockRfpDocument({ id: 1, status: 'uploaded', rawText: 'Extracted PDF text content for testing.' });
    mockModels.RfpDocument.create.mockResolvedValue(mockDoc);

    const res = await request(app)
      .post('/api/rfp-documents/upload')
      .attach('file', Buffer.from('%PDF-1.4 fake pdf content'), { filename: 'test.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(mockModels.RfpDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        originalFilename: 'test.pdf',
        status: 'uploaded',
      })
    );
  });

  test('400 — rejects when no file is provided', async () => {
    const res = await request(app)
      .post('/api/rfp-documents/upload')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('No file uploaded');
  });
});

describe('POST /api/rfp-documents/:id/extract', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — extracts requirements from uploaded document', async () => {
    const mockDoc = createMockRfpDocument({ id: 1, status: 'uploaded' });
    mockModels.RfpDocument.findByPk.mockResolvedValue(mockDoc);

    const extractedData = createMockExtractedData();
    mockAiService.extractRequirements.mockResolvedValue(extractedData);

    const res = await request(app)
      .post('/api/rfp-documents/1/extract');

    expect(res.status).toBe(200);
    expect(mockDoc.update).toHaveBeenCalledWith({ status: 'extracting' });
    expect(mockAiService.extractRequirements).toHaveBeenCalledWith(mockDoc.rawText);
    expect(mockDoc.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'extracted', extractedData })
    );
  });

  test('404 — returns error for non-existent document', async () => {
    mockModels.RfpDocument.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/rfp-documents/999/extract');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Document not found');
  });

  test('400 — rejects document with no text content', async () => {
    const mockDoc = createMockRfpDocument({ id: 1, rawText: '', status: 'uploaded' });
    mockModels.RfpDocument.findByPk.mockResolvedValue(mockDoc);

    const res = await request(app)
      .post('/api/rfp-documents/1/extract');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('No text content');
  });
});

describe('GET /api/rfp-documents', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — lists all documents with metadata', async () => {
    const docs = [
      createMockRfpDocument({ id: 1 }),
      createMockRfpDocument({ id: 2 }),
    ];
    mockModels.RfpDocument.findAll.mockResolvedValue(docs);

    const res = await request(app)
      .get('/api/rfp-documents');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('200 — returns empty array when no documents exist', async () => {
    mockModels.RfpDocument.findAll.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/rfp-documents');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/rfp-documents/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — returns document with generated proposals', async () => {
    const mockDoc = createMockRfpDocument({
      id: 1,
      generatedProposals: [createMockGeneratedProposal({ id: 10, rfpDocumentId: 1 })],
    });
    mockModels.RfpDocument.findByPk.mockResolvedValue(mockDoc);

    const res = await request(app)
      .get('/api/rfp-documents/1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
  });

  test('404 — returns error for non-existent document', async () => {
    mockModels.RfpDocument.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/rfp-documents/999');

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/rfp-documents/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — deletes document and cascades to proposals', async () => {
    const mockDoc = createMockRfpDocument({ id: 1 });
    mockModels.RfpDocument.findByPk.mockResolvedValue(mockDoc);
    mockModels.GeneratedProposal.destroy.mockResolvedValue(2);

    const res = await request(app)
      .delete('/api/rfp-documents/1');

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');
    expect(mockModels.GeneratedProposal.destroy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { rfpDocumentId: 1 } })
    );
    expect(mockDoc.destroy).toHaveBeenCalled();
  });

  test('404 — returns error for non-existent document', async () => {
    mockModels.RfpDocument.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/rfp-documents/999');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/rfp-documents/:id/generate', () => {
  beforeEach(() => jest.clearAllMocks());

  test('201 — generates proposal from extracted requirements', async () => {
    const mockDoc = createMockRfpDocument({ id: 1, status: 'extracted' });
    mockModels.RfpDocument.findByPk.mockResolvedValue(mockDoc);
    mockModels.GeneratedProposal.count.mockResolvedValue(0);

    const mockGenProposal = createMockGeneratedProposal({ id: 10, rfpDocumentId: 1, status: 'generating' });
    mockModels.GeneratedProposal.create.mockResolvedValue(mockGenProposal);

    const proposalContent = createMockProposalContent();
    mockAiService.generateProposal.mockResolvedValue(proposalContent);

    const res = await request(app)
      .post('/api/rfp-documents/1/generate')
      .send({ companyProfile: { company_name: 'Test Corp' } });

    expect(res.status).toBe(201);
    expect(mockAiService.generateProposal).toHaveBeenCalledWith(
      mockDoc.extractedData,
      expect.objectContaining({ company_name: 'Test Corp' })
    );
  });

  test('400 — rejects when requirements not yet extracted', async () => {
    const mockDoc = createMockRfpDocument({ id: 1, status: 'uploaded', extractedData: null });
    mockModels.RfpDocument.findByPk.mockResolvedValue(mockDoc);

    const res = await request(app)
      .post('/api/rfp-documents/1/generate')
      .send({ companyProfile: { company_name: 'Test' } });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('extracted');
  });

  test('400 — rejects when company_name is missing', async () => {
    const mockDoc = createMockRfpDocument({ id: 1, status: 'extracted' });
    mockModels.RfpDocument.findByPk.mockResolvedValue(mockDoc);

    const res = await request(app)
      .post('/api/rfp-documents/1/generate')
      .send({ companyProfile: { expertise: 'Software' } });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'companyProfile.company_name' })])
    );
  });

  test('404 — returns error for non-existent document', async () => {
    mockModels.RfpDocument.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/rfp-documents/999/generate')
      .send({ companyProfile: { company_name: 'Test' } });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/rfp-documents/:docId/proposals', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — lists generated proposals for a document', async () => {
    const proposals = [
      createMockGeneratedProposal({ id: 1, rfpDocumentId: 5, version: 1 }),
      createMockGeneratedProposal({ id: 2, rfpDocumentId: 5, version: 2 }),
    ];
    mockModels.GeneratedProposal.findAll.mockResolvedValue(proposals);

    const res = await request(app)
      .get('/api/rfp-documents/5/proposals');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

describe('GET /api/rfp-documents/:docId/proposals/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — returns specific generated proposal with RFP document', async () => {
    const mockProposal = createMockGeneratedProposal({
      id: 10,
      rfpDocumentId: 5,
      rfpDocument: createMockRfpDocument({ id: 5 }),
    });
    mockModels.GeneratedProposal.findOne.mockResolvedValue(mockProposal);

    const res = await request(app)
      .get('/api/rfp-documents/5/proposals/10');

    expect(res.status).toBe(200);
    expect(mockModels.GeneratedProposal.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: '10', rfpDocumentId: '5' },
      })
    );
  });

  test('404 — returns error for non-existent proposal', async () => {
    mockModels.GeneratedProposal.findOne.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/rfp-documents/5/proposals/999');

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/rfp-documents/:docId/proposals/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — updates proposal content and status', async () => {
    const mockProposal = createMockGeneratedProposal({ id: 10, rfpDocumentId: 5 });
    mockModels.GeneratedProposal.findOne.mockResolvedValue(mockProposal);

    const res = await request(app)
      .put('/api/rfp-documents/5/proposals/10')
      .send({ title: 'Updated Title', status: 'edited' });

    expect(res.status).toBe(200);
    expect(mockProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Updated Title', status: 'edited' })
    );
  });

  test('400 — rejects invalid status values', async () => {
    const mockProposal = createMockGeneratedProposal({ id: 10, rfpDocumentId: 5 });
    mockModels.GeneratedProposal.findOne.mockResolvedValue(mockProposal);

    const res = await request(app)
      .put('/api/rfp-documents/5/proposals/10')
      .send({ status: 'invalid_status' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  test('200 — accepts finalized status', async () => {
    const mockProposal = createMockGeneratedProposal({ id: 10, rfpDocumentId: 5 });
    mockModels.GeneratedProposal.findOne.mockResolvedValue(mockProposal);

    const res = await request(app)
      .put('/api/rfp-documents/5/proposals/10')
      .send({ status: 'finalized' });

    expect(res.status).toBe(200);
    expect(mockProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'finalized' })
    );
  });

  test('404 — returns error for non-existent proposal', async () => {
    mockModels.GeneratedProposal.findOne.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/rfp-documents/5/proposals/999')
      .send({ title: 'Update' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/rfp-documents/:docId/proposals/:id/export', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — exports proposal as PDF by default', async () => {
    const mockProposal = createMockGeneratedProposal({
      id: 10,
      rfpDocumentId: 5,
      title: 'Test Proposal',
      rfpDocument: createMockRfpDocument({ id: 5 }),
    });
    mockModels.GeneratedProposal.findOne.mockResolvedValue(mockProposal);
    const fakePdf = Buffer.from('%PDF-1.4 fake');
    mockExportService.generatePdf.mockResolvedValue(fakePdf);

    const res = await request(app)
      .get('/api/rfp-documents/5/proposals/10/export');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('.pdf');
    expect(mockExportService.generatePdf).toHaveBeenCalledWith(mockProposal);
  });

  test('200 — exports proposal as PDF with explicit format', async () => {
    const mockProposal = createMockGeneratedProposal({ id: 10, rfpDocumentId: 5 });
    mockModels.GeneratedProposal.findOne.mockResolvedValue(mockProposal);
    const fakePdf = Buffer.from('%PDF-1.4 fake');
    mockExportService.generatePdf.mockResolvedValue(fakePdf);

    const res = await request(app)
      .get('/api/rfp-documents/5/proposals/10/export?format=pdf');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(mockExportService.generatePdf).toHaveBeenCalled();
  });

  test('200 — exports proposal as DOCX', async () => {
    const mockProposal = createMockGeneratedProposal({ id: 10, rfpDocumentId: 5, title: 'DOCX Proposal' });
    mockModels.GeneratedProposal.findOne.mockResolvedValue(mockProposal);
    const fakeDocx = Buffer.from('PK fake docx');
    mockExportService.generateDocx.mockResolvedValue(fakeDocx);

    const res = await request(app)
      .get('/api/rfp-documents/5/proposals/10/export?format=docx');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(res.headers['content-disposition']).toContain('.docx');
    expect(mockExportService.generateDocx).toHaveBeenCalledWith(mockProposal);
  });

  test('400 — rejects invalid format', async () => {
    const res = await request(app)
      .get('/api/rfp-documents/5/proposals/10/export?format=txt');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  test('404 — returns error for non-existent proposal', async () => {
    mockModels.GeneratedProposal.findOne.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/rfp-documents/5/proposals/999/export');

    expect(res.status).toBe(404);
  });

  test('400 — rejects proposal with no content', async () => {
    const mockProposal = createMockGeneratedProposal({ id: 10, rfpDocumentId: 5 });
    mockProposal.proposalContent = null;
    mockModels.GeneratedProposal.findOne.mockResolvedValue(mockProposal);

    const res = await request(app)
      .get('/api/rfp-documents/5/proposals/10/export');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('no content');
  });

  test('sets correct filename from proposal title', async () => {
    const mockProposal = createMockGeneratedProposal({
      id: 10,
      rfpDocumentId: 5,
      title: 'My Great Proposal',
      version: 3,
    });
    mockModels.GeneratedProposal.findOne.mockResolvedValue(mockProposal);
    mockExportService.generatePdf.mockResolvedValue(Buffer.from('%PDF-1.4'));

    const res = await request(app)
      .get('/api/rfp-documents/5/proposals/10/export');

    expect(res.headers['content-disposition']).toContain('My Great Proposal_v3.pdf');
  });
});
