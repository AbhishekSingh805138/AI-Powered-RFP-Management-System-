const OpenAI = require('openai');
const { DocumentEmbedding } = require('../models');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHUNK_SIZE = 800; // characters per chunk
const CHUNK_OVERLAP = 200; // overlap between chunks

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
      const lastNewline = cleaned.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > start + chunkSize * 0.5) {
        end = breakPoint + 1;
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
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in a batch.
 */
async function generateEmbeddingsBatch(texts) {
  if (texts.length === 0) return [];

  // OpenAI supports batch embedding
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });

  return response.data.map((d) => d.embedding);
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Index a document: chunk it, generate embeddings, store in DB.
 * Removes old embeddings for the same source before inserting.
 */
async function indexDocument(sourceType, sourceId, text, title, metadata = {}) {
  if (!text || !text.trim()) return { indexed: 0 };

  // Remove existing embeddings for this source
  await DocumentEmbedding.destroy({
    where: { sourceType, sourceId },
  });

  const chunks = chunkText(text);
  if (chunks.length === 0) return { indexed: 0 };

  // Generate embeddings in batches of 20
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

  await DocumentEmbedding.bulkCreate(records);

  return { indexed: records.length, chunks: chunks.length };
}

/**
 * Semantic search: embed query, find top-K most similar chunks.
 */
async function semanticSearch(query, topK = 10, filterSourceType = null) {
  const queryEmbedding = await generateEmbedding(query);

  // Fetch all embeddings (with optional source type filter)
  const where = {};
  if (filterSourceType) {
    where.sourceType = filterSourceType;
  }

  const allEmbeddings = await DocumentEmbedding.findAll({
    where,
    attributes: ['id', 'sourceType', 'sourceId', 'sourceTitle', 'chunkIndex', 'chunkText', 'embedding', 'metadata'],
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
