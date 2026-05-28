const OpenAI = require('openai');
const embeddingService = require('./embeddingService');
const { ChatConversation, ChatMessage } = require('../models');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = 'gpt-4o-mini';

const MAX_HISTORY_MESSAGES = 10;

/**
 * Send a message in a conversation with RAG-grounded response.
 * Retrieves relevant document chunks, builds context, and generates a response.
 */
async function chat(conversationId, userMessage, options = {}) {
  const { topK = 6, filterSourceType = null } = options;

  // Step 1: Save user message
  const userMsg = await ChatMessage.create({
    conversationId,
    role: 'user',
    content: userMessage,
  });

  // Step 2: Retrieve conversation history for context
  const history = await ChatMessage.findAll({
    where: { conversationId },
    order: [['created_at', 'DESC']],
    limit: MAX_HISTORY_MESSAGES,
  });
  const orderedHistory = history.reverse();

  // Step 3: Semantic search for relevant document chunks
  let relevantChunks = [];
  let sources = null;
  try {
    relevantChunks = await embeddingService.semanticSearch(userMessage, topK, filterSourceType);
  } catch (err) {
    // If embedding search fails (e.g. no indexed docs), continue without RAG context
  }

  // Step 4: Build context from retrieved chunks
  let ragContext = '';
  if (relevantChunks.length > 0) {
    ragContext = relevantChunks.map((chunk, i) =>
      `[Source ${i + 1}: ${chunk.sourceTitle} (${chunk.sourceType})]:\n${chunk.chunkText}`
    ).join('\n\n---\n\n');

    sources = relevantChunks.map((c) => ({
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      sourceTitle: c.sourceTitle,
      chunkText: c.chunkText,
      similarity: Math.round(c.similarity * 1000) / 1000,
    }));
  }

  // Step 5: Build messages for OpenAI
  const systemContent = ragContext
    ? `You are an intelligent RFP assistant with access to a knowledge base of RFP documents and proposals. Answer questions using the provided context and conversation history. Be specific and cite source documents when relevant.

If the context doesn't contain enough information, say so honestly rather than guessing.

Relevant context from knowledge base:
${ragContext}`
    : `You are an intelligent RFP assistant. Help the user with questions about RFP management, proposal writing, procurement processes, and related topics. Be specific, professional, and actionable.

No documents are currently indexed in the knowledge base. Let the user know they can index documents for more specific answers.`;

  const messages = [
    { role: 'system', content: systemContent },
  ];

  // Add conversation history (skip the user message we just created, it's added separately)
  for (const msg of orderedHistory) {
    if (msg.id === userMsg.id) continue;
    messages.push({ role: msg.role, content: msg.content });
  }
  messages.push({ role: 'user', content: userMessage });

  // Step 6: Generate response
  const startTime = Date.now();
  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    messages,
  });
  const responseTime = Date.now() - startTime;

  const assistantContent = response.choices[0].message.content;

  // Step 7: Save assistant message
  const assistantMsg = await ChatMessage.create({
    conversationId,
    role: 'assistant',
    content: assistantContent,
    sources,
    metadata: {
      model: MODEL,
      responseTimeMs: responseTime,
      chunksRetrieved: relevantChunks.length,
    },
  });

  // Step 8: Update conversation lastMessageAt
  await ChatConversation.update(
    { lastMessageAt: new Date() },
    { where: { id: conversationId } }
  );

  return {
    message: {
      id: assistantMsg.id,
      role: 'assistant',
      content: assistantContent,
      sources,
      metadata: assistantMsg.metadata,
      createdAt: assistantMsg.createdAt,
    },
    userMessage: {
      id: userMsg.id,
      role: 'user',
      content: userMessage,
      createdAt: userMsg.createdAt,
    },
  };
}

/**
 * Generate a short conversation title from the first few messages.
 */
async function generateConversationTitle(messages) {
  const preview = messages.slice(0, 4).map((m) => `${m.role}: ${m.content}`).join('\n');

  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Generate a short, descriptive title (5-8 words max) for this conversation. Return JSON: {"title": "your title here"}`,
      },
      {
        role: 'user',
        content: preview,
      },
    ],
  });

  const result = JSON.parse(response.choices[0].message.content);
  return result.title;
}

/**
 * Generate suggested follow-up questions based on conversation context.
 */
async function getSuggestedQuestions(conversationId) {
  const recentMessages = await ChatMessage.findAll({
    where: { conversationId },
    order: [['created_at', 'DESC']],
    limit: 6,
  });

  if (recentMessages.length === 0) {
    return [
      'What RFP documents have been uploaded?',
      'Summarize the key requirements across all RFPs',
      'What are the common compliance requirements?',
      'Compare the budget ranges across RFPs',
    ];
  }

  const context = recentMessages.reverse().map((m) => `${m.role}: ${m.content}`).join('\n');

  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Based on this conversation, suggest 3-4 natural follow-up questions the user might want to ask. Make them specific and actionable.

Return JSON: {"questions": ["question1", "question2", "question3"]}`,
      },
      {
        role: 'user',
        content: context,
      },
    ],
  });

  const result = JSON.parse(response.choices[0].message.content);
  return result.questions;
}

module.exports = {
  chat,
  generateConversationTitle,
  getSuggestedQuestions,
};
