/**
 * Service-level tests for complianceService.
 */

process.env.OPENAI_API_KEY = 'test-key';

const mockChatCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockChatCreate } },
  }));
});

const { checkCompliance } = require('../../src/services/complianceService');
const { createMockExtractedData, createMockProposalContent } = require('../helpers/mockFactories');

describe('complianceService — checkCompliance()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('calls OpenAI with correct parameters and returns parsed result', async () => {
    const mockResult = {
      overall_score: 85,
      overall_status: 'partially_compliant',
      summary: 'The proposal addresses most requirements but has gaps in security compliance.',
      statistics: {
        total_requirements: 10,
        fully_addressed: 7,
        partially_addressed: 2,
        not_addressed: 1,
        risks_identified: 3,
      },
      technical_compliance: [
        {
          requirement_id: 'TR-1',
          requirement: 'OAuth 2.0 authentication',
          status: 'compliant',
          proposal_response: 'Full OAuth 2.0 implementation planned',
          gap_description: null,
          recommendation: null,
          severity: 'none',
        },
      ],
      compliance_requirements: [],
      deliverable_compliance: [],
      budget_compliance: { rfp_budget: '$500,000', proposal_cost: '$450,000', status: 'within_budget', analysis: 'Under budget' },
      timeline_compliance: { rfp_timeline: '6 months', proposal_timeline: '6 months', status: 'meets_deadline', analysis: 'On track' },
      risks: [],
      strengths: ['Strong technical approach'],
      improvement_areas: ['Add security certifications'],
    };

    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockResult) } }],
    });

    const rfpReqs = createMockExtractedData();
    const proposalContent = createMockProposalContent();

    const result = await checkCompliance(rfpReqs, proposalContent);

    // Verify OpenAI was called
    expect(mockChatCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockChatCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('gpt-4o-mini');
    expect(callArgs.temperature).toBe(0.1);
    expect(callArgs.response_format).toEqual({ type: 'json_object' });

    // Verify system prompt contains the requirements and proposal
    const systemContent = callArgs.messages[0].content;
    expect(systemContent).toContain('compliance analyst');
    expect(systemContent).toContain('TR-1'); // From extractedData
    expect(systemContent).toContain('OAuth 2.0'); // From extractedData

    // Verify result
    expect(result.overall_score).toBe(85);
    expect(result.overall_status).toBe('partially_compliant');
    expect(result.statistics.total_requirements).toBe(10);
    expect(result.technical_compliance).toHaveLength(1);
    expect(result.budget_compliance.status).toBe('within_budget');
  });

  test('handles string proposal content (raw text)', async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ overall_score: 60, overall_status: 'partially_compliant' }) } }],
    });

    await checkCompliance(createMockExtractedData(), 'This is raw proposal text.');

    const systemContent = mockChatCreate.mock.calls[0][0].messages[0].content;
    expect(systemContent).toContain('This is raw proposal text.');
  });

  test('handles JSON proposal content (object)', async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ overall_score: 90 }) } }],
    });

    const proposalObj = createMockProposalContent();
    await checkCompliance(createMockExtractedData(), proposalObj);

    const systemContent = mockChatCreate.mock.calls[0][0].messages[0].content;
    expect(systemContent).toContain('executive_summary');
  });

  test('propagates OpenAI API errors', async () => {
    mockChatCreate.mockRejectedValue(new Error('OpenAI API error'));
    await expect(
      checkCompliance(createMockExtractedData(), 'proposal')
    ).rejects.toThrow('OpenAI API error');
  });

  test('throws on invalid JSON response from OpenAI', async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: 'this is not json' } }],
    });

    await expect(
      checkCompliance(createMockExtractedData(), 'proposal')
    ).rejects.toThrow();
  });
});
