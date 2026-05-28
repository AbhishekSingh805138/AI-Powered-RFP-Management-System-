const OpenAI = require('openai');
const embeddingService = require('./embeddingService');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = 'gpt-4o-mini';

/**
 * RAG Search: Embed query → retrieve relevant chunks → generate AI answer with citations.
 */
async function ragSearch(query, options = {}) {
  const { topK = 8, filterSourceType = null } = options;

  // Step 1: Semantic search for relevant chunks
  const relevantChunks = await embeddingService.semanticSearch(query, topK, filterSourceType);

  if (relevantChunks.length === 0) {
    return {
      answer: 'No relevant documents found in the knowledge base. Please index some documents first.',
      sources: [],
      chunks: [],
    };
  }

  // Step 2: Build context from top chunks
  const context = relevantChunks.map((chunk, i) =>
    `[Source ${i + 1}: ${chunk.sourceTitle} (${chunk.sourceType})]:\n${chunk.chunkText}`
  ).join('\n\n---\n\n');

  // Step 3: Generate answer using context
  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: `You are an RFP knowledge assistant. Answer the user's question using ONLY the provided context from the document knowledge base. Be specific and cite which source documents support your answer.

If the context doesn't contain enough information to fully answer, say so clearly.

Format your response with:
- A clear, direct answer
- References to which source documents (by name) support each claim
- Any relevant quotes from the sources

Context from knowledge base:
${context}`,
      },
      {
        role: 'user',
        content: query,
      },
    ],
  });

  // Deduplicate sources
  const sourceMap = new Map();
  relevantChunks.forEach((chunk) => {
    const key = `${chunk.sourceType}-${chunk.sourceId}`;
    if (!sourceMap.has(key)) {
      sourceMap.set(key, {
        sourceType: chunk.sourceType,
        sourceId: chunk.sourceId,
        sourceTitle: chunk.sourceTitle,
        topSimilarity: chunk.similarity,
        chunkCount: 1,
      });
    } else {
      sourceMap.get(key).chunkCount++;
      sourceMap.get(key).topSimilarity = Math.max(sourceMap.get(key).topSimilarity, chunk.similarity);
    }
  });

  return {
    answer: response.choices[0].message.content,
    sources: Array.from(sourceMap.values()).sort((a, b) => b.topSimilarity - a.topSimilarity),
    chunks: relevantChunks.map((c) => ({
      sourceTitle: c.sourceTitle,
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      chunkText: c.chunkText,
      similarity: Math.round(c.similarity * 1000) / 1000,
    })),
  };
}

module.exports = {
  ragSearch,
};
