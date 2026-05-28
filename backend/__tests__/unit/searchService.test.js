/**
 * Service-level tests for searchService (RAG search).
 */

process.env.OPENAI_API_KEY = 'test-key';

const mockChatCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockChatCreate } },
  }));
});

const mockEmbeddingService = {
  semanticSearch: jest.fn(),
};
jest.mock('../../src/services/embeddingService', () => mockEmbeddingService);

const { ragSearch } = require('../../src/services/searchService');

describe('searchService — ragSearch()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns "no documents" message when no chunks found', async () => {
    mockEmbeddingService.semanticSearch.mockResolvedValue([]);

    const result = await ragSearch('test query');
    expect(result.answer).toContain('No relevant documents found');
    expect(result.sources).toEqual([]);
    expect(result.chunks).toEqual([]);
    expect(mockChatCreate).not.toHaveBeenCalled();
  });

  test('builds context from chunks and calls GPT for answer', async () => {
    const chunks = [
      { id: 1, sourceType: 'rfp_document', sourceId: 1, sourceTitle: 'Test RFP', chunkIndex: 0, chunkText: 'Requirements include OAuth 2.0 authentication.', metadata: {}, similarity: 0.92 },
      { id: 2, sourceType: 'rfp_document', sourceId: 1, sourceTitle: 'Test RFP', chunkIndex: 1, chunkText: 'Budget is capped at $500,000.', metadata: {}, similarity: 0.85 },
    ];
    mockEmbeddingService.semanticSearch.mockResolvedValue(chunks);

    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: 'The RFP requires OAuth 2.0 authentication with a $500K budget.' } }],
    });

    const result = await ragSearch('What are the requirements?');

    expect(mockEmbeddingService.semanticSearch).toHaveBeenCalledWith('What are the requirements?', 8, null);
    expect(mockChatCreate).toHaveBeenCalledTimes(1);

    // Verify context includes chunk text
    const systemMessage = mockChatCreate.mock.calls[0][0].messages[0].content;
    expect(systemMessage).toContain('Requirements include OAuth 2.0');
    expect(systemMessage).toContain('Budget is capped');

    expect(result.answer).toContain('OAuth 2.0');
    expect(result.sources).toHaveLength(1); // Deduplicated to 1 source
    expect(result.sources[0].sourceTitle).toBe('Test RFP');
    expect(result.sources[0].chunkCount).toBe(2);
    expect(result.chunks).toHaveLength(2);
  });

  test('deduplicates sources from multiple chunks of same document', async () => {
    const chunks = [
      { id: 1, sourceType: 'rfp_document', sourceId: 1, sourceTitle: 'Doc A', chunkIndex: 0, chunkText: 'Chunk 1', metadata: {}, similarity: 0.95 },
      { id: 2, sourceType: 'rfp_document', sourceId: 1, sourceTitle: 'Doc A', chunkIndex: 1, chunkText: 'Chunk 2', metadata: {}, similarity: 0.90 },
      { id: 3, sourceType: 'generated_proposal', sourceId: 5, sourceTitle: 'Proposal B', chunkIndex: 0, chunkText: 'Chunk 3', metadata: {}, similarity: 0.80 },
    ];
    mockEmbeddingService.semanticSearch.mockResolvedValue(chunks);
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: 'Answer' } }],
    });

    const result = await ragSearch('query');
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0].topSimilarity).toBe(0.95);
    expect(result.sources[0].chunkCount).toBe(2);
    expect(result.sources[1].sourceTitle).toBe('Proposal B');
  });

  test('respects topK and filterSourceType options', async () => {
    mockEmbeddingService.semanticSearch.mockResolvedValue([]);

    await ragSearch('query', { topK: 5, filterSourceType: 'proposal' });
    expect(mockEmbeddingService.semanticSearch).toHaveBeenCalledWith('query', 5, 'proposal');
  });

  test('rounds similarity scores to 3 decimal places in output chunks', async () => {
    const chunks = [
      { id: 1, sourceType: 'rfp_document', sourceId: 1, sourceTitle: 'Doc', chunkIndex: 0, chunkText: 'Text', metadata: {}, similarity: 0.923456789 },
    ];
    mockEmbeddingService.semanticSearch.mockResolvedValue(chunks);
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: 'Answer' } }],
    });

    const result = await ragSearch('query');
    expect(result.chunks[0].similarity).toBe(0.923);
  });

  test('propagates errors from embedding service', async () => {
    mockEmbeddingService.semanticSearch.mockRejectedValue(new Error('Embedding service down'));
    await expect(ragSearch('query')).rejects.toThrow('Embedding service down');
  });
});
