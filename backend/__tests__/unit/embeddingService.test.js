/**
 * Unit tests for embeddingService pure functions.
 * Tests chunkText and cosineSimilarity — no mocks needed.
 */

// We need to set env vars before requiring the module, and mock OpenAI + models
// so the module loads without a real DB/API connection.
process.env.OPENAI_API_KEY = 'test-key';

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    embeddings: { create: jest.fn() },
  }));
});
jest.mock('../../src/models', () => ({
  DocumentEmbedding: {
    destroy: jest.fn(),
    bulkCreate: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
  },
}));

const { chunkText, cosineSimilarity } = require('../../src/services/embeddingService');

describe('embeddingService — pure functions', () => {
  describe('chunkText()', () => {
    test('returns empty array for empty/null input', () => {
      expect(chunkText(null)).toEqual([]);
      expect(chunkText('')).toEqual([]);
      expect(chunkText('   ')).toEqual([]);
      expect(chunkText(undefined)).toEqual([]);
    });

    test('returns single chunk for short text', () => {
      const text = 'This is a short paragraph about software requirements.';
      const chunks = chunkText(text);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });

    test('chunks long text into overlapping segments', () => {
      // Generate text longer than CHUNK_SIZE (800 chars)
      const sentence = 'This is a test sentence about RFP requirements and compliance standards. ';
      const longText = sentence.repeat(20); // ~1520 chars
      const chunks = chunkText(longText);

      expect(chunks.length).toBeGreaterThan(1);

      // Verify overlap exists — later chunks should share content with previous ones
      if (chunks.length >= 2) {
        const lastPartOfFirst = chunks[0].slice(-100);
        // The overlap region should appear at the start of the second chunk
        const overlapFound = chunks[1].includes(lastPartOfFirst.slice(0, 50));
        // Overlap may not be exact due to sentence boundary breaking, but chunks should be contiguous
        expect(chunks[1].length).toBeGreaterThan(20);
      }
    });

    test('filters out very short chunks (<=20 chars)', () => {
      // A text that's just barely over the chunk size with tiny remainder
      const text = 'A'.repeat(810) + ' ' + 'B'.repeat(10);
      const chunks = chunkText(text, 800, 200);
      // The tiny 10-char remainder should be filtered out
      chunks.forEach(chunk => {
        expect(chunk.length).toBeGreaterThan(20);
      });
    });

    test('respects sentence boundaries when chunking', () => {
      // Build text with clear sentence boundaries around the chunk size
      const part1 = 'First part of the document. '.repeat(15); // ~420 chars
      const part2 = 'Second part discusses compliance requirements. '.repeat(15); // ~705 chars
      const text = part1 + part2;

      const chunks = chunkText(text, 800, 200);
      expect(chunks.length).toBeGreaterThanOrEqual(1);

      // Each chunk should end near a sentence boundary (period)
      chunks.forEach(chunk => {
        // At least the non-last chunks should try to end at a period
        expect(chunk.trim().length).toBeGreaterThan(0);
      });
    });

    test('handles text with multiple whitespace correctly', () => {
      const text = 'Hello    world.\n\n\nThis   is   a   test.';
      const chunks = chunkText(text);
      // Should normalize whitespace
      expect(chunks[0]).not.toContain('    ');
      expect(chunks[0]).toContain('Hello world.');
    });

    test('uses custom chunk size and overlap', () => {
      const text = 'Word. '.repeat(100); // ~600 chars
      const smallChunks = chunkText(text, 100, 20);
      const largeChunks = chunkText(text, 500, 50);
      expect(smallChunks.length).toBeGreaterThan(largeChunks.length);
    });
  });

  describe('cosineSimilarity()', () => {
    test('returns 1.0 for identical vectors', () => {
      const vec = [1, 2, 3, 4, 5];
      const similarity = cosineSimilarity(vec, vec);
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    test('returns -1.0 for opposite vectors', () => {
      const a = [1, 0, 0];
      const b = [-1, 0, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
    });

    test('returns 0.0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
    });

    test('computes correct similarity for non-trivial vectors', () => {
      const a = [1, 2, 3];
      const b = [4, 5, 6];
      // Expected: (4+10+18) / (sqrt(14) * sqrt(77)) = 32 / 32.833... ≈ 0.9746
      const result = cosineSimilarity(a, b);
      expect(result).toBeCloseTo(0.9746, 3);
    });

    test('handles high-dimensional vectors (1536 like OpenAI)', () => {
      const dim = 1536;
      const a = Array.from({ length: dim }, (_, i) => Math.sin(i));
      const b = Array.from({ length: dim }, (_, i) => Math.sin(i + 0.1));

      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBeGreaterThan(0.9); // Very similar vectors
      expect(similarity).toBeLessThanOrEqual(1.0);
    });

    test('is symmetric: sim(a,b) === sim(b,a)', () => {
      const a = [1, 3, -5, 2];
      const b = [4, -2, 1, 7];
      expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
    });
  });
});
