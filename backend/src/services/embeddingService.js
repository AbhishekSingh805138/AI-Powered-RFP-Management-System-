const OpenAI = require('openai');
const { DocumentEmbedding } = require('../models');
const sequelize = require('../config/database');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
const CHUNK_SIZE = 800; // characters per chunk
const CHUNK_OVERLAP = 200; // overlap between chunks
const AI_TIMEOUT = parseInt(process.env.AI_TIMEOUT_MS, 10) || 60000;

/**
 * Wrapper for OpenAI embedding calls with timeout and error handling.
 */
async function createEmbedding(params, context) {
  try {
    const response = await openai.embeddings.create(params, {
      timeout: AI_TIMEOUT,
    });

    if (!response.data || response.data.length === 0) {
      const err = new Error(`AI returned no embeddings during ${context}`);
      err.status = 502;
      throw err;
    }

    return response;
  } catch (err) {
    if (err.status === 502) throw err;

    if (err.code === 'ETIMEDOUT' || err.type === 'request-timeout' || err.message?.includes('timeout')) {
      const timeoutErr = new Error(`Embedding request timed out during ${context} (limit: ${AI_TIMEOUT}ms)`);
      timeoutErr.status = 504;
      throw timeoutErr;
    }

    if (err.status === 429) {
      const rateLimitErr = new Error('AI rate limit exceeded. Please try again later.');
      rateLimitErr.status = 429;
      throw rateLimitErr;
    }

    if (err.status >= 500) {
      const upstreamErr = new Error(`AI service unavailable during ${context}`);
      upstreamErr.status = 502;
      throw upstreamErr;
    }

    const wrappedErr = new Error(`Embedding request failed during ${context}: ${err.message}`);
    wrappedErr.status = err.status || 500;
    throw wrappedErr;
  }
}

/**
 * Split text into overlapping chunks for embedding.
 */
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  if (!text || !text.trim()) return [];

  const cleaned = text.replace(/\s+/g, ' ').trim();
  const chunks = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = start + chunkSize;

    // Try to break at sentence boundary
    if (end < cleaned.length) {
      const lastPeriod = cleaned.lastIndexOf('. ', end);
      if (lastPeriod > start + chunkSize * 0.5) {
        end = lastPeriod + 1;
      }
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk.length > 20) {
      chunks.push(chunk);
    }

    start = end - overlap;
    if (start >= cleaned.length) break;
  }

  return chunks;
}

/**
 * Generate embedding vector for a text using OpenAI.
 */
async function generateEmbedding(text) {
  const response = await createEmbedding({
    model: EMBEDDING_MODEL,
    input: text,
  }, 'single embedding');
  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in a batch.
 */
async function generateEmbeddingsBatch(texts) {
  if (texts.length === 0) return [];

  const response = await createEmbedding({
    model: EMBEDDING_MODEL,
    input: texts,
  }, 'batch embedding');

  return response.data.map((d) => d.embedding);
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * Index a document: chunk it, generate embeddings, store in DB.
 * Removes old embeddings for the same source before inserting.
 */
async function indexDocument(sourceType, sourceId, text, title, metadata = {}) {
  if (!text || !text.trim()) return { indexed: 0 };

  const chunks = chunkText(text);
  if (chunks.length === 0) return { indexed: 0 };

  // Generate embeddings in batches of 20 (outside transaction — API calls shouldn't hold DB locks)
  const batchSize = 20;
  const records = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await generateEmbeddingsBatch(batch);

    for (let j = 0; j < batch.length; j++) {
      records.push({
        sourceType,
        sourceId,
        sourceTitle: title || `${sourceType}-${sourceId}`,
        chunkIndex: i + j,
        chunkText: batch[j],
        embedding: embeddings[j],
        metadata: { ...metadata, totalChunks: chunks.length },
      });
    }
  }

  // Atomic replace: delete old + insert new in a single transaction
  await sequelize.transaction(async (t) => {
    await DocumentEmbedding.destroy({ where: { sourceType, sourceId }, transaction: t });
    await DocumentEmbedding.bulkCreate(records, { transaction: t });
  });

  return { indexed: records.length, chunks: chunks.length };
}

/**
 * Semantic search: embed query, find top-K most similar chunks.
 * MAX_SEARCH_ROWS caps the number of rows loaded into memory for cosine comparison.
 */
const MAX_SEARCH_ROWS = parseInt(process.env.MAX_SEARCH_ROWS, 10) || 5000;

async function semanticSearch(query, topK = 10, filterSourceType = null) {
  const queryEmbedding = await generateEmbedding(query);

  // Fetch embeddings with optional source type filter, capped for memory safety
  const where = {};
  if (filterSourceType) {
    where.sourceType = filterSourceType;
  }

  const allEmbeddings = await DocumentEmbedding.findAll({
    where,
    attributes: ['id', 'sourceType', 'sourceId', 'sourceTitle', 'chunkIndex', 'chunkText', 'embedding', 'metadata'],
    limit: MAX_SEARCH_ROWS,
    order: [['created_at', 'DESC']],
  });

  // Compute similarities
  const results = allEmbeddings.map((doc) => ({
    id: doc.id,
    sourceType: doc.sourceType,
    sourceId: doc.sourceId,
    sourceTitle: doc.sourceTitle,
    chunkIndex: doc.chunkIndex,
    chunkText: doc.chunkText,
    metadata: doc.metadata,
    similarity: cosineSimilarity(queryEmbedding, doc.embedding),
  }));

  // Sort by similarity and return top-K
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, topK);
}

/**
 * Get embedding stats: count of indexed documents and chunks.
 */
async function getIndexStats() {
  const total = await DocumentEmbedding.count();

  const byType = await DocumentEmbedding.findAll({
    attributes: [
      'sourceType',
      [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'chunkCount'],
      [require('sequelize').fn('COUNT', require('sequelize').fn('DISTINCT', require('sequelize').col('source_id'))), 'docCount'],
    ],
    group: ['sourceType'],
    raw: true,
  });

  return { totalChunks: total, byType };
}

module.exports = {
  chunkText,
  generateEmbedding,
  generateEmbeddingsBatch,
  cosineSimilarity,
  indexDocument,
  semanticSearch,
  getIndexStats,
};
