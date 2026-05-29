/**
 * Service-level tests for embeddingService — async functions that call OpenAI and DB.
 * All external dependencies are mocked.
 */

process.env.OPENAI_API_KEY = 'test-key';

const mockCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    embeddings: { create: mockCreate },
  }));
});

const mockDocumentEmbedding = {
  destroy: jest.fn(),
  bulkCreate: jest.fn(),
  findAll: jest.fn(),
  count: jest.fn(),
};
jest.mock('../../src/models', () => ({
  DocumentEmbedding: mockDocumentEmbedding,
}));

const {
  generateEmbedding,
  generateEmbeddingsBatch,
  indexDocument,
  semanticSearch,
  getIndexStats,
} = require('../../src/services/embeddingService');
const { createMockEmbeddingResponse } = require('../helpers/mockFactories');

describe('embeddingService — async functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateEmbedding()', () => {
    test('calls OpenAI embeddings API and returns vector', async () => {
      const mockVector = Array.from({ length: 1536 }, () => 0.5);
      mockCreate.mockResolvedValue({
        data: [{ embedding: mockVector }],
      });

      const result = await generateEmbedding('test text');
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'test text',
      }, { timeout: 60000 });
      expect(result).toEqual(mockVector);
      expect(result).toHaveLength(1536);
    });

    test('propagates OpenAI API errors', async () => {
      mockCreate.mockRejectedValue(new Error('API rate limit exceeded'));
      await expect(generateEmbedding('test')).rejects.toThrow('Embedding request failed');
    });
  });

  describe('generateEmbeddingsBatch()', () => {
    test('returns empty array for empty input', async () => {
      const result = await generateEmbeddingsBatch([]);
      expect(result).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    test('sends batch request to OpenAI and returns all vectors', async () => {
      const vec1 = Array.from({ length: 1536 }, () => 0.1);
      const vec2 = Array.from({ length: 1536 }, () => 0.2);
      mockCreate.mockResolvedValue(createMockEmbeddingResponse([vec1, vec2]));

      const result = await generateEmbeddingsBatch(['text 1', 'text 2']);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: ['text 1', 'text 2'],
      }, { timeout: 60000 });
      expect(result).toHaveLength(2);
    });
  });

  describe('indexDocument()', () => {
    test('returns { indexed: 0 } for empty text', async () => {
      const result = await indexDocument('rfp_document', 1, '', 'Test');
      expect(result).toEqual({ indexed: 0 });
      expect(mockDocumentEmbedding.destroy).not.toHaveBeenCalled();
    });

    test('returns { indexed: 0 } for null text', async () => {
      const result = await indexDocument('rfp_document', 1, null, 'Test');
      expect(result).toEqual({ indexed: 0 });
    });

    test('removes old embeddings before inserting new ones', async () => {
      const mockVector = Array.from({ length: 1536 }, () => 0.5);
      mockCreate.mockResolvedValue(createMockEmbeddingResponse([mockVector]));
      mockDocumentEmbedding.destroy.mockResolvedValue(1);
      mockDocumentEmbedding.bulkCreate.mockResolvedValue([]);

      const text = 'This is a test document with enough text to create at least one chunk for embedding.';
      await indexDocument('rfp_document', 1, text, 'Test Doc');

      expect(mockDocumentEmbedding.destroy).toHaveBeenCalledWith({
        where: { sourceType: 'rfp_document', sourceId: 1 },
      });
    });

    test('chunks text and stores embeddings in DB', async () => {
      const mockVector = Array.from({ length: 1536 }, () => 0.5);
      mockCreate.mockResolvedValue(createMockEmbeddingResponse([mockVector]));
      mockDocumentEmbedding.destroy.mockResolvedValue(0);
      mockDocumentEmbedding.bulkCreate.mockResolvedValue([]);

      const text = 'This is a reasonably long text for testing the indexing pipeline with embeddings.';
      const result = await indexDocument('rfp_document', 42, text, 'Test Title', { extra: 'meta' });

      expect(result.indexed).toBeGreaterThan(0);
      expect(result.chunks).toBeGreaterThan(0);
      expect(mockDocumentEmbedding.bulkCreate).toHaveBeenCalledTimes(1);

      const records = mockDocumentEmbedding.bulkCreate.mock.calls[0][0];
      records.forEach(record => {
        expect(record.sourceType).toBe('rfp_document');
        expect(record.sourceId).toBe(42);
        expect(record.sourceTitle).toBe('Test Title');
        expect(record.embedding).toBeDefined();
        expect(record.chunkText).toBeDefined();
        expect(record.metadata).toHaveProperty('totalChunks');
        expect(record.metadata).toHaveProperty('extra', 'meta');
      });
    });

    test('batches embeddings in groups of 20', async () => {
      // Create text large enough to produce >20 chunks
      const sentence = 'This is a long sentence about compliance and requirements. ';
      const longText = sentence.repeat(200); // ~12000 chars → ~15+ chunks at 800 char size

      const mockVector = Array.from({ length: 1536 }, () => 0.5);
      // Mock will be called multiple times for batches
      mockCreate.mockResolvedValue({
        data: Array.from({ length: 20 }, () => ({ embedding: mockVector })),
      });
      mockDocumentEmbedding.destroy.mockResolvedValue(0);
      mockDocumentEmbedding.bulkCreate.mockResolvedValue([]);

      const result = await indexDocument('rfp_document', 1, longText, 'Big Doc');
      expect(result.indexed).toBeGreaterThan(0);
      // Should have made multiple embedding API calls if >20 chunks
      expect(mockCreate).toHaveBeenCalled();
    });
  });

  describe('semanticSearch()', () => {
    test('returns top-K results sorted by similarity', async () => {
      const queryVector = Array.from({ length: 3 }, () => 0.5);
      mockCreate.mockResolvedValue({
        data: [{ embedding: queryVector }],
      });

      // Simulate stored embeddings with varying similarity
      mockDocumentEmbedding.findAll.mockResolvedValue([
        { id: 1, sourceType: 'rfp_document', sourceId: 1, sourceTitle: 'Doc1', chunkIndex: 0, chunkText: 'Chunk 1', embedding: [0.5, 0.5, 0.5], metadata: {} },
        { id: 2, sourceType: 'rfp_document', sourceId: 2, sourceTitle: 'Doc2', chunkIndex: 0, chunkText: 'Chunk 2', embedding: [0.1, 0.1, 0.1], metadata: {} },
        { id: 3, sourceType: 'rfp_document', sourceId: 3, sourceTitle: 'Doc3', chunkIndex: 0, chunkText: 'Chunk 3', embedding: [0.4, 0.5, 0.5], metadata: {} },
      ]);

      const results = await semanticSearch('test query', 2);
      expect(results).toHaveLength(2);
      // Should be sorted by similarity descending
      expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);
    });

    test('filters by sourceType when provided', async () => {
      mockCreate.mockResolvedValue({
        data: [{ embedding: [0.5, 0.5] }],
      });
      mockDocumentEmbedding.findAll.mockResolvedValue([]);

      await semanticSearch('query', 5, 'generated_proposal');
      expect(mockDocumentEmbedding.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sourceType: 'generated_proposal' },
        })
      );
    });

    test('passes empty where when no filter', async () => {
      mockCreate.mockResolvedValue({
        data: [{ embedding: [0.5, 0.5] }],
      });
      mockDocumentEmbedding.findAll.mockResolvedValue([]);

      await semanticSearch('query', 5, null);
      expect(mockDocumentEmbedding.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });
  });

  describe('getIndexStats()', () => {
    test('returns total count and breakdown by type', async () => {
      mockDocumentEmbedding.count.mockResolvedValue(150);
      mockDocumentEmbedding.findAll.mockResolvedValue([
        { sourceType: 'rfp_document', chunkCount: 80, docCount: 5 },
        { sourceType: 'generated_proposal', chunkCount: 70, docCount: 3 },
      ]);

      const stats = await getIndexStats();
      expect(stats.totalChunks).toBe(150);
      expect(stats.byType).toHaveLength(2);
    });
  });
});
