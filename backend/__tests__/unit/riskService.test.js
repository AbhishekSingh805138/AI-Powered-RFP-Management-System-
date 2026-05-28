/**
 * Unit tests for riskService — AI-powered risk analysis.
 */

process.env.OPENAI_API_KEY = 'test-key';

const mockCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

const riskService = require('../../src/services/riskService');
const { createMockRfpDocument, createMockGeneratedProposal } = require('../helpers/mockFactories');

describe('riskService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeRisks', () => {
    const mockResult = {
      overall_risk_score: 45,
      overall_risk_level: 'medium',
      executive_summary: 'Moderate risk level identified.',
      categories: [
        { name: 'technical', score: 50, level: 'medium', description: 'Some gaps', risks: [] },
      ],
      risk_matrix: [],
      top_risks: [],
      recommendations: [],
      strengths: ['Strong team'],
      watch_items: ['Budget constraints'],
    };

    test('calls OpenAI with correct params for RFP-only analysis', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResult) } }],
      });

      const rfpDoc = createMockRfpDocument();
      const result = await riskService.analyzeRisks(rfpDoc);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.model).toBe('gpt-4o-mini');
      expect(callArgs.temperature).toBe(0.1);
      expect(callArgs.response_format).toEqual({ type: 'json_object' });
      expect(callArgs.messages[0].content).toContain('No proposal provided');
      expect(result.overall_risk_score).toBe(45);
    });

    test('includes proposal content when provided', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResult) } }],
      });

      const rfpDoc = createMockRfpDocument();
      const proposal = createMockGeneratedProposal();
      await riskService.analyzeRisks(rfpDoc, proposal);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('PROPOSAL CONTENT');
      expect(callArgs.messages[0].content).not.toContain('No proposal provided');
    });

    test('handles string proposal content', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResult) } }],
      });

      const rfpDoc = createMockRfpDocument();
      const proposal = createMockGeneratedProposal({ proposalContent: 'Plain text proposal' });
      await riskService.analyzeRisks(rfpDoc, proposal);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Plain text proposal');
    });

    test('propagates OpenAI errors', async () => {
      mockCreate.mockRejectedValue(new Error('API quota exceeded'));
      const rfpDoc = createMockRfpDocument();
      await expect(riskService.analyzeRisks(rfpDoc)).rejects.toThrow('API quota exceeded');
    });

    test('returns all expected fields', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResult) } }],
      });

      const rfpDoc = createMockRfpDocument();
      const result = await riskService.analyzeRisks(rfpDoc);

      expect(result).toHaveProperty('overall_risk_score');
      expect(result).toHaveProperty('overall_risk_level');
      expect(result).toHaveProperty('executive_summary');
      expect(result).toHaveProperty('categories');
      expect(result).toHaveProperty('risk_matrix');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('strengths');
      expect(result).toHaveProperty('watch_items');
    });
  });

  describe('compareRiskProfiles', () => {
    const mockComparison = {
      summary: 'Two analyses compared.',
      common_risks: [],
      divergent_risks: [],
      category_comparison: [],
      recommendation: 'Focus on compliance gaps.',
    };

    test('calls OpenAI with correct params', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockComparison) } }],
      });

      const analyses = [
        { id: 1, rfpDocumentId: 1, generatedProposalId: null, overallRiskScore: 45, overallRiskLevel: 'medium', analysisData: {} },
        { id: 2, rfpDocumentId: 2, generatedProposalId: 3, overallRiskScore: 72, overallRiskLevel: 'high', analysisData: {} },
      ];

      const result = await riskService.compareRiskProfiles(analyses);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.temperature).toBe(0.2);
      expect(callArgs.response_format).toEqual({ type: 'json_object' });
      expect(result.summary).toBeDefined();
    });

    test('propagates errors', async () => {
      mockCreate.mockRejectedValue(new Error('Timeout'));
      await expect(riskService.compareRiskProfiles([{}, {}])).rejects.toThrow('Timeout');
    });
  });
});
