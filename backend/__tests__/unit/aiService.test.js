/**
 * Service-level tests for aiService — all 5 AI functions.
 */

process.env.OPENAI_API_KEY = 'test-key';

const mockChatCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockChatCreate } },
  }));
});

const {
  parseRfpFromNaturalLanguage,
  parseVendorProposal,
  compareProposals,
  extractRequirements,
  generateProposal,
} = require('../../src/services/aiService');
const { createMockExtractedData, createMockOpenAIResponse } = require('../helpers/mockFactories');

describe('aiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseRfpFromNaturalLanguage()', () => {
    test('parses natural language into structured RFP data', async () => {
      const mockParsed = {
        title: 'Office Laptop Procurement',
        items: [{ name: 'Laptop', quantity: 100, specifications: '16GB RAM', estimatedUnitPrice: 1200 }],
        budget: { total: 120000, currency: 'USD' },
        timeline: { deliveryDays: 30, deadline: null },
        terms: { paymentTerms: 'Net 30', warranty: '1 year', otherTerms: [] },
        requirements: ['Must be business-grade'],
        evaluationCriteria: ['price', 'quality'],
      };

      mockChatCreate.mockResolvedValue(createMockOpenAIResponse(mockParsed));

      const result = await parseRfpFromNaturalLanguage('We need 100 laptops with 16GB RAM');

      expect(mockChatCreate).toHaveBeenCalledTimes(1);
      expect(result.title).toBe('Office Laptop Procurement');
      expect(result.items).toHaveLength(1);
      expect(result.budget.total).toBe(120000);

      // Verify the model and settings
      const callArgs = mockChatCreate.mock.calls[0][0];
      expect(callArgs.model).toBe('gpt-4o-mini');
      expect(callArgs.temperature).toBe(0.1);
      expect(callArgs.response_format).toEqual({ type: 'json_object' });
    });

    test('propagates API errors', async () => {
      mockChatCreate.mockRejectedValue(new Error('Rate limited'));
      await expect(parseRfpFromNaturalLanguage('test')).rejects.toThrow('Rate limited');
    });
  });

  describe('parseVendorProposal()', () => {
    test('parses vendor proposal text with RFP context', async () => {
      const mockParsed = {
        vendorName: 'Dell Inc',
        lineItems: [{ itemName: 'Laptop', quantity: 100, unitPrice: 1100, totalPrice: 110000 }],
        totalPrice: 110000,
        currency: 'USD',
        deliveryTimeline: '15 business days',
        complianceScore: 90,
      };
      mockChatCreate.mockResolvedValue(createMockOpenAIResponse(mockParsed));

      const rfpContext = { title: 'Laptop RFP', items: [{ name: 'Laptop', quantity: 100 }] };
      const result = await parseVendorProposal('We offer Dell Latitude laptops at $1100 each.', rfpContext);

      expect(result.vendorName).toBe('Dell Inc');
      expect(result.totalPrice).toBe(110000);

      // Verify RFP context is included in the prompt
      const systemContent = mockChatCreate.mock.calls[0][0].messages[0].content;
      expect(systemContent).toContain('Laptop RFP');
    });
  });

  describe('compareProposals()', () => {
    test('compares multiple proposals and returns recommendation', async () => {
      const mockComparison = {
        vendorScores: [
          { vendorId: 1, vendorName: 'Dell', totalScore: 85, scores: {} },
          { vendorId: 2, vendorName: 'HP', totalScore: 78, scores: {} },
        ],
        recommendation: { vendorId: 1, vendorName: 'Dell', confidence: 'high', reasoning: 'Best value' },
        summary: 'Dell provides the best overall value.',
      };
      mockChatCreate.mockResolvedValue(createMockOpenAIResponse(mockComparison));

      const rfpData = { title: 'Laptop RFP' };
      const proposals = [
        { vendorId: 1, vendorName: 'Dell', parsedData: {}, totalPrice: 110000 },
        { vendorId: 2, vendorName: 'HP', parsedData: {}, totalPrice: 115000 },
      ];

      const result = await compareProposals(rfpData, proposals);

      expect(result.vendorScores).toHaveLength(2);
      expect(result.recommendation.vendorId).toBe(1);
      expect(result.recommendation.confidence).toBe('high');
    });
  });

  describe('extractRequirements()', () => {
    test('extracts structured requirements from document text', async () => {
      const mockExtracted = createMockExtractedData();
      mockChatCreate.mockResolvedValue(createMockOpenAIResponse(mockExtracted));

      const result = await extractRequirements('Full document text here...');

      expect(result.title).toBe('Enterprise Software Development RFP');
      expect(result.technical_requirements).toBeDefined();
      expect(result.compliance_requirements).toBeDefined();
      expect(result.deliverables).toBeDefined();

      // Verify the user message contains the document text
      const userContent = mockChatCreate.mock.calls[0][0].messages[1].content;
      expect(userContent).toBe('Full document text here...');
    });
  });

  describe('generateProposal()', () => {
    test('generates proposal from extracted requirements and company profile', async () => {
      const mockProposal = {
        title: 'Response to Enterprise RFP',
        executive_summary: 'We propose a comprehensive solution...',
        technical_approach: { overview: 'Cloud-native architecture' },
        scope_of_work: [{ phase: 'Discovery', activities: [] }],
        cost_breakdown: { total_estimated_cost: '$450,000' },
      };
      mockChatCreate.mockResolvedValue(createMockOpenAIResponse(mockProposal));

      const requirements = createMockExtractedData();
      const companyProfile = { company_name: 'Test Corp', expertise: 'Enterprise software' };

      const result = await generateProposal(requirements, companyProfile);

      expect(result.title).toContain('Enterprise RFP');
      expect(result.executive_summary).toBeDefined();
      expect(result.cost_breakdown.total_estimated_cost).toBe('$450,000');

      // Verify both requirements and profile are in the prompt
      const systemContent = mockChatCreate.mock.calls[0][0].messages[0].content;
      expect(systemContent).toContain('Enterprise Software Development RFP');
      expect(systemContent).toContain('Test Corp');

      // Verify higher temperature for creative writing
      expect(mockChatCreate.mock.calls[0][0].temperature).toBe(0.3);
    });
  });
});
