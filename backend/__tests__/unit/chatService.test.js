/**
 * Unit tests for chatService — RAG-grounded conversational AI.
 */

process.env.OPENAI_API_KEY = 'test-key';

const mockCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

// Mock models
const mockMessages = [];
const mockConversations = [];

jest.mock('../../src/models', () => ({
  ChatConversation: {
    update: jest.fn(),
  },
  ChatMessage: {
    create: jest.fn(async (data) => {
      const msg = { id: mockMessages.length + 1, ...data, createdAt: new Date().toISOString() };
      mockMessages.push(msg);
      return msg;
    }),
    findAll: jest.fn(async () => [...mockMessages].reverse()),
    count: jest.fn(async () => mockMessages.length),
  },
}));

jest.mock('../../src/services/embeddingService', () => ({
  semanticSearch: jest.fn().mockResolvedValue([
    {
      id: 1,
      sourceType: 'rfp_document',
      sourceId: 1,
      sourceTitle: 'Cloud RFP',
      chunkText: 'AWS migration requirements',
      similarity: 0.92,
    },
  ]),
}));

const chatService = require('../../src/services/chatService');
const embeddingService = require('../../src/services/embeddingService');
const { ChatMessage, ChatConversation } = require('../../src/models');

describe('chatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMessages.length = 0;
  });

  describe('chat', () => {
    test('saves user and assistant messages', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Here is my response based on the documents.' } }],
      });

      const result = await chatService.chat(1, 'What certifications are needed?');

      // User message created
      expect(ChatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: 1, role: 'user', content: 'What certifications are needed?' })
      );
      // Assistant message created
      expect(ChatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: 1, role: 'assistant' })
      );
      expect(result.message.role).toBe('assistant');
      expect(result.userMessage.role).toBe('user');
    });

    test('calls semantic search for RAG context', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Based on the documents...' } }],
      });

      await chatService.chat(1, 'Tell me about pricing');

      expect(embeddingService.semanticSearch).toHaveBeenCalledWith('Tell me about pricing', 6, null);
    });

    test('passes filter options to semantic search', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Response' } }],
      });

      await chatService.chat(1, 'Query', { topK: 3, filterSourceType: 'rfp_document' });

      expect(embeddingService.semanticSearch).toHaveBeenCalledWith('Query', 3, 'rfp_document');
    });

    test('includes sources in assistant message', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'The RFP requires AWS...' } }],
      });

      const result = await chatService.chat(1, 'Requirements?');

      expect(result.message.sources).toBeDefined();
      expect(result.message.sources.length).toBeGreaterThan(0);
      expect(result.message.sources[0].sourceTitle).toBe('Cloud RFP');
    });

    test('continues without RAG when embedding search fails', async () => {
      embeddingService.semanticSearch.mockRejectedValueOnce(new Error('No embeddings'));
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'I can help with general questions.' } }],
      });

      const result = await chatService.chat(1, 'Hello');

      expect(result.message.content).toBe('I can help with general questions.');
    });

    test('updates conversation lastMessageAt', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Done.' } }],
      });

      await chatService.chat(1, 'test');

      expect(ChatConversation.update).toHaveBeenCalledWith(
        expect.objectContaining({ lastMessageAt: expect.any(Date) }),
        { where: { id: 1 } }
      );
    });

    test('includes metadata with timing info', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Fast response' } }],
      });

      const result = await chatService.chat(1, 'test');

      expect(result.message.metadata).toBeDefined();
      expect(result.message.metadata.model).toBe('gpt-4o-mini');
      expect(result.message.metadata.responseTimeMs).toBeDefined();
    });
  });

  describe('generateConversationTitle', () => {
    test('returns a title string', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ title: 'Cloud Migration Discussion' }) } }],
      });

      const messages = [
        { role: 'user', content: 'Tell me about cloud migration RFPs' },
        { role: 'assistant', content: 'Cloud migration RFPs typically require...' },
      ];

      const title = await chatService.generateConversationTitle(messages);

      expect(title).toBe('Cloud Migration Discussion');
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.temperature).toBe(0.2);
      expect(callArgs.response_format).toEqual({ type: 'json_object' });
    });
  });

  describe('getSuggestedQuestions', () => {
    test('returns default questions when no messages exist', async () => {
      ChatMessage.findAll.mockResolvedValueOnce([]);

      const questions = await chatService.getSuggestedQuestions(1);

      expect(questions).toBeInstanceOf(Array);
      expect(questions.length).toBe(4);
      // Should not call OpenAI for defaults
      expect(mockCreate).not.toHaveBeenCalled();
    });

    test('generates AI questions when messages exist', async () => {
      ChatMessage.findAll.mockResolvedValueOnce([
        { role: 'user', content: 'What are the budget requirements?' },
        { role: 'assistant', content: 'The budget is $500,000...' },
      ]);

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ questions: ['What about timeline?', 'Any compliance needs?', 'Team requirements?'] }) } }],
      });

      const questions = await chatService.getSuggestedQuestions(1);

      expect(questions.length).toBe(3);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });
});
