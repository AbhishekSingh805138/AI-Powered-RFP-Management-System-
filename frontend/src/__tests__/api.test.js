/**
 * Tests for the frontend API service layer.
 * Verifies all API functions call axios with correct HTTP methods, URLs, and payloads.
 */

import axios from 'axios';

jest.mock('axios', () => {
  const instance = {
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} }),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    create: jest.fn(() => instance),
    __instance: instance,
  };
});

const api = axios.__instance;

// Import all API functions
import {
  // Phase 1 — RFPs
  createRfp,
  listRfps,
  getRfp,
  updateRfp,
  deleteRfp,
  sendRfpToVendors,
  compareProposals,

  // Phase 1 — Vendors
  createVendor,
  listVendors,
  getVendor,
  updateVendor,
  deleteVendor,

  // Phase 1 — Proposals
  createProposal,
  uploadProposal,
  listProposals,
  getProposal,
  parseProposal,

  // Phase 2 — RFP Documents
  uploadRfpDocument,
  extractRfpRequirements,
  listRfpDocuments,
  getRfpDocument,
  deleteRfpDocument,

  // Phase 2 — Generated Proposals
  generateProposalFromRfp,
  listGeneratedProposals,
  getGeneratedProposal,
  updateGeneratedProposal,

  // Phase 2 — Semantic Search
  semanticSearch,
  indexDocument,
  indexAllDocuments,
  getSearchStats,

  // Phase 2 — Compliance
  checkCompliance,

  // Phase 3 — Risk Analysis
  analyzeRisks,
  getRiskAnalysis,
  listRiskAnalyses,
  compareRiskProfiles,
  deleteRiskAnalysis,

  // Phase 3 — Chat
  createConversation,
  listConversations,
  getConversation,
  sendChatMessage,
  archiveConversation,
  deleteConversation,
  getSuggestedQuestions,
} from '../services/api';

describe('Frontend API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Phase 1: RFPs ---
  describe('RFP endpoints', () => {
    test('createRfp sends POST /rfps with rawInput', async () => {
      await createRfp('Need 100 laptops');
      expect(api.post).toHaveBeenCalledWith('/rfps', { rawInput: 'Need 100 laptops' });
    });

    test('listRfps sends GET /rfps', async () => {
      await listRfps();
      expect(api.get).toHaveBeenCalledWith('/rfps');
    });

    test('getRfp sends GET /rfps/:id', async () => {
      await getRfp(5);
      expect(api.get).toHaveBeenCalledWith('/rfps/5');
    });

    test('updateRfp sends PUT /rfps/:id', async () => {
      await updateRfp(3, { title: 'Updated' });
      expect(api.put).toHaveBeenCalledWith('/rfps/3', { title: 'Updated' });
    });

    test('deleteRfp sends DELETE /rfps/:id', async () => {
      await deleteRfp(7);
      expect(api.delete).toHaveBeenCalledWith('/rfps/7');
    });

    test('sendRfpToVendors sends POST with vendorIds', async () => {
      await sendRfpToVendors(1, [2, 3]);
      expect(api.post).toHaveBeenCalledWith('/rfps/1/send', { vendorIds: [2, 3] });
    });

    test('compareProposals sends POST /rfps/:id/compare', async () => {
      await compareProposals(1);
      expect(api.post).toHaveBeenCalledWith('/rfps/1/compare');
    });
  });

  // --- Phase 1: Vendors ---
  describe('Vendor endpoints', () => {
    test('createVendor sends POST /vendors', async () => {
      await createVendor({ name: 'Acme', email: 'a@b.com' });
      expect(api.post).toHaveBeenCalledWith('/vendors', { name: 'Acme', email: 'a@b.com' });
    });

    test('listVendors sends GET /vendors with params', async () => {
      await listVendors({ search: 'test' });
      expect(api.get).toHaveBeenCalledWith('/vendors', { params: { search: 'test' } });
    });

    test('getVendor sends GET /vendors/:id', async () => {
      await getVendor(1);
      expect(api.get).toHaveBeenCalledWith('/vendors/1');
    });

    test('updateVendor sends PUT /vendors/:id', async () => {
      await updateVendor(1, { name: 'New Name' });
      expect(api.put).toHaveBeenCalledWith('/vendors/1', { name: 'New Name' });
    });

    test('deleteVendor sends DELETE /vendors/:id', async () => {
      await deleteVendor(3);
      expect(api.delete).toHaveBeenCalledWith('/vendors/3');
    });
  });

  // --- Phase 1: Proposals ---
  describe('Proposal endpoints', () => {
    test('createProposal sends POST /proposals/manual', async () => {
      await createProposal({ rfpId: 1, vendorId: 2, rawContent: 'text' });
      expect(api.post).toHaveBeenCalledWith('/proposals/manual', { rfpId: 1, vendorId: 2, rawContent: 'text' });
    });

    test('uploadProposal sends POST with multipart form data', async () => {
      const formData = new FormData();
      await uploadProposal(formData);
      expect(api.post).toHaveBeenCalledWith('/proposals/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    });

    test('listProposals sends GET with rfpId param', async () => {
      await listProposals(5);
      expect(api.get).toHaveBeenCalledWith('/proposals', { params: { rfpId: 5 } });
    });

    test('getProposal sends GET /proposals/:id', async () => {
      await getProposal(10);
      expect(api.get).toHaveBeenCalledWith('/proposals/10');
    });

    test('parseProposal sends POST /proposals/:id/parse', async () => {
      await parseProposal(3);
      expect(api.post).toHaveBeenCalledWith('/proposals/3/parse');
    });
  });

  // --- Phase 2: RFP Documents ---
  describe('RFP Document endpoints', () => {
    test('uploadRfpDocument sends POST with multipart form data', async () => {
      const formData = new FormData();
      await uploadRfpDocument(formData);
      expect(api.post).toHaveBeenCalledWith('/rfp-documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    });

    test('extractRfpRequirements sends POST /rfp-documents/:id/extract', async () => {
      await extractRfpRequirements(5);
      expect(api.post).toHaveBeenCalledWith('/rfp-documents/5/extract');
    });

    test('listRfpDocuments sends GET /rfp-documents', async () => {
      await listRfpDocuments();
      expect(api.get).toHaveBeenCalledWith('/rfp-documents');
    });

    test('getRfpDocument sends GET /rfp-documents/:id', async () => {
      await getRfpDocument(3);
      expect(api.get).toHaveBeenCalledWith('/rfp-documents/3');
    });

    test('deleteRfpDocument sends DELETE /rfp-documents/:id', async () => {
      await deleteRfpDocument(7);
      expect(api.delete).toHaveBeenCalledWith('/rfp-documents/7');
    });
  });

  // --- Phase 2: Generated Proposals ---
  describe('Generated Proposal endpoints', () => {
    test('generateProposalFromRfp sends POST with company profile', async () => {
      const profile = { company_name: 'Test Corp' };
      await generateProposalFromRfp(5, profile);
      expect(api.post).toHaveBeenCalledWith('/rfp-documents/5/generate', { companyProfile: profile });
    });

    test('listGeneratedProposals sends GET /rfp-documents/:docId/proposals', async () => {
      await listGeneratedProposals(3);
      expect(api.get).toHaveBeenCalledWith('/rfp-documents/3/proposals');
    });

    test('getGeneratedProposal sends GET with docId and id', async () => {
      await getGeneratedProposal(3, 10);
      expect(api.get).toHaveBeenCalledWith('/rfp-documents/3/proposals/10');
    });

    test('updateGeneratedProposal sends PUT with data', async () => {
      await updateGeneratedProposal(3, 10, { status: 'edited' });
      expect(api.put).toHaveBeenCalledWith('/rfp-documents/3/proposals/10', { status: 'edited' });
    });
  });

  // --- Phase 2: Semantic Search ---
  describe('Semantic Search endpoints', () => {
    test('semanticSearch sends POST /search with query and options', async () => {
      await semanticSearch('pricing info', { topK: 5, filterSourceType: 'proposal' });
      expect(api.post).toHaveBeenCalledWith('/search', {
        query: 'pricing info',
        topK: 5,
        filterSourceType: 'proposal',
      });
    });

    test('semanticSearch sends POST with defaults for empty options', async () => {
      await semanticSearch('test query');
      expect(api.post).toHaveBeenCalledWith('/search', { query: 'test query' });
    });

    test('indexDocument sends POST /search/index/:sourceType/:sourceId', async () => {
      await indexDocument('rfp_document', 5);
      expect(api.post).toHaveBeenCalledWith('/search/index/rfp_document/5');
    });

    test('indexAllDocuments sends POST /search/index-all', async () => {
      await indexAllDocuments();
      expect(api.post).toHaveBeenCalledWith('/search/index-all');
    });

    test('getSearchStats sends GET /search/stats', async () => {
      await getSearchStats();
      expect(api.get).toHaveBeenCalledWith('/search/stats');
    });
  });

  // --- Phase 2: Compliance ---
  describe('Compliance endpoints', () => {
    test('checkCompliance sends POST /compliance/check', async () => {
      await checkCompliance({ rfpDocumentId: 1, generatedProposalId: 5 });
      expect(api.post).toHaveBeenCalledWith('/compliance/check', {
        rfpDocumentId: 1,
        generatedProposalId: 5,
      });
    });

    test('checkCompliance with proposal text', async () => {
      await checkCompliance({ rfpDocumentId: 1, proposalText: 'Raw text' });
      expect(api.post).toHaveBeenCalledWith('/compliance/check', {
        rfpDocumentId: 1,
        proposalText: 'Raw text',
      });
    });
  });

  // --- Phase 3: Risk Analysis ---
  describe('Risk Analysis endpoints', () => {
    test('analyzeRisks sends POST /risk-analysis', async () => {
      await analyzeRisks({ rfpDocumentId: 1, generatedProposalId: 3 });
      expect(api.post).toHaveBeenCalledWith('/risk-analysis', {
        rfpDocumentId: 1,
        generatedProposalId: 3,
      });
    });

    test('getRiskAnalysis sends GET /risk-analysis/:id', async () => {
      await getRiskAnalysis(5);
      expect(api.get).toHaveBeenCalledWith('/risk-analysis/5');
    });

    test('listRiskAnalyses sends GET /risk-analysis with params', async () => {
      await listRiskAnalyses({ rfpDocumentId: 2 });
      expect(api.get).toHaveBeenCalledWith('/risk-analysis', { params: { rfpDocumentId: 2 } });
    });

    test('compareRiskProfiles sends POST /risk-analysis/compare', async () => {
      await compareRiskProfiles([1, 2, 3]);
      expect(api.post).toHaveBeenCalledWith('/risk-analysis/compare', { analysisIds: [1, 2, 3] });
    });

    test('deleteRiskAnalysis sends DELETE /risk-analysis/:id', async () => {
      await deleteRiskAnalysis(7);
      expect(api.delete).toHaveBeenCalledWith('/risk-analysis/7');
    });
  });

  // --- Phase 3: Chat ---
  describe('Chat endpoints', () => {
    test('createConversation sends POST /chat/conversations', async () => {
      await createConversation('My Chat');
      expect(api.post).toHaveBeenCalledWith('/chat/conversations', { title: 'My Chat' });
    });

    test('listConversations sends GET /chat/conversations', async () => {
      await listConversations({ status: 'active' });
      expect(api.get).toHaveBeenCalledWith('/chat/conversations', { params: { status: 'active' } });
    });

    test('getConversation sends GET /chat/conversations/:id', async () => {
      await getConversation(3);
      expect(api.get).toHaveBeenCalledWith('/chat/conversations/3');
    });

    test('sendChatMessage sends POST /chat/conversations/:id/messages', async () => {
      await sendChatMessage(1, 'Hello world', { topK: 5 });
      expect(api.post).toHaveBeenCalledWith('/chat/conversations/1/messages', {
        content: 'Hello world',
        options: { topK: 5 },
      });
    });

    test('archiveConversation sends PUT /chat/conversations/:id/archive', async () => {
      await archiveConversation(5);
      expect(api.put).toHaveBeenCalledWith('/chat/conversations/5/archive');
    });

    test('deleteConversation sends DELETE /chat/conversations/:id', async () => {
      await deleteConversation(2);
      expect(api.delete).toHaveBeenCalledWith('/chat/conversations/2');
    });

    test('getSuggestedQuestions sends GET /chat/conversations/:id/suggestions', async () => {
      await getSuggestedQuestions(4);
      expect(api.get).toHaveBeenCalledWith('/chat/conversations/4/suggestions');
    });
  });
});
