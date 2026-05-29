/**
 * API tests for GET /api/jobs/:id
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

// Mock the jobQueue to test the endpoint behavior
const mockJobQueue = {
  isAvailable: jest.fn(),
  getJobById: jest.fn(),
  enqueue: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  JOBS: {
    EXTRACT_REQUIREMENTS: 'extract-requirements',
    GENERATE_PROPOSAL: 'generate-proposal',
    ANALYZE_RISKS: 'analyze-risks',
  },
};
jest.mock('../../src/services/jobQueue', () => mockJobQueue);

jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 1, email: 'test@test.com', role: 'admin' };
    next();
  },
  requireRole: () => (req, res, next) => next(),
}));

const { createApp } = require('../../src/app');
const app = createApp();

describe('GET /api/jobs/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('404 — returns error when queue is not available', async () => {
    mockJobQueue.isAvailable.mockReturnValue(false);

    const res = await request(app).get('/api/jobs/some-uuid');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('not available');
  });

  test('404 — returns error when job not found', async () => {
    mockJobQueue.isAvailable.mockReturnValue(true);
    mockJobQueue.getJobById.mockResolvedValue(null);

    const res = await request(app).get('/api/jobs/nonexistent-id');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('not found');
  });

  test('200 — returns job status for active job', async () => {
    mockJobQueue.isAvailable.mockReturnValue(true);
    mockJobQueue.getJobById.mockResolvedValue({
      id: 'job-123',
      name: 'extract-requirements',
      state: 'active',
      data: { documentId: 1 },
      createdon: '2026-05-28T12:00:00Z',
      startedon: '2026-05-28T12:00:01Z',
      completedon: null,
    });

    const res = await request(app).get('/api/jobs/job-123');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      id: 'job-123',
      name: 'extract-requirements',
      state: 'active',
      data: { documentId: 1 },
    }));
  });

  test('200 — returns completed job', async () => {
    mockJobQueue.isAvailable.mockReturnValue(true);
    mockJobQueue.getJobById.mockResolvedValue({
      id: 'job-456',
      name: 'generate-proposal',
      state: 'completed',
      data: { documentId: 1, proposalId: 5 },
      createdon: '2026-05-28T12:00:00Z',
      startedon: '2026-05-28T12:00:01Z',
      completedon: '2026-05-28T12:01:00Z',
    });

    const res = await request(app).get('/api/jobs/job-456');

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('completed');
    expect(res.body.completedOn).toBe('2026-05-28T12:01:00Z');
  });

  test('200 — returns failed job with error message', async () => {
    mockJobQueue.isAvailable.mockReturnValue(true);
    mockJobQueue.getJobById.mockResolvedValue({
      id: 'job-789',
      name: 'analyze-risks',
      state: 'failed',
      data: { riskAnalysisId: 3 },
      output: { message: 'OpenAI API rate limit exceeded' },
      createdon: '2026-05-28T12:00:00Z',
      startedon: '2026-05-28T12:00:01Z',
      completedon: null,
    });

    const res = await request(app).get('/api/jobs/job-789');

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('failed');
    expect(res.body.error).toBe('OpenAI API rate limit exceeded');
  });

  test('200 — handles string error output', async () => {
    mockJobQueue.isAvailable.mockReturnValue(true);
    mockJobQueue.getJobById.mockResolvedValue({
      id: 'job-err',
      name: 'extract-requirements',
      state: 'failed',
      data: {},
      output: 'Something went wrong',
      createdon: '2026-05-28T12:00:00Z',
      startedon: null,
      completedon: null,
    });

    const res = await request(app).get('/api/jobs/job-err');

    expect(res.status).toBe(200);
    expect(res.body.error).toBe('Something went wrong');
  });
});
