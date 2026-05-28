const { ChatConversation, ChatMessage } = require('../models');
const chatService = require('../services/chatService');

// POST /api/chat/conversations — Create a new conversation
async function createConversation(req, res, next) {
  try {
    const { title } = req.body;

    const conversation = await ChatConversation.create({
      title: title || 'New Conversation',
      status: 'active',
      lastMessageAt: new Date(),
      userId: req.user.id,
    });

    res.status(201).json(conversation);
  } catch (err) {
    next(err);
  }
}

// GET /api/chat/conversations — List conversations (scoped to user, admins see all)
async function listConversations(req, res, next) {
  try {
    const where = {};
    if (req.user.role !== 'admin') {
      where.userId = req.user.id;
    }
    if (req.query.status) {
      where.status = req.query.status;
    } else {
      where.status = 'active';
    }

    const conversations = await ChatConversation.findAll({
      where,
      order: [['last_message_at', 'DESC']],
      attributes: ['id', 'title', 'status', 'metadata', 'lastMessageAt', 'createdAt'],
    });

    res.json(conversations);
  } catch (err) {
    next(err);
  }
}

// GET /api/chat/conversations/:id — Get conversation with messages
async function getConversation(req, res, next) {
  try {
    const conversation = await ChatConversation.findByPk(req.params.id, {
      include: [{
        model: ChatMessage,
        as: 'messages',
        order: [['created_at', 'ASC']],
      }],
    });

    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (req.user.role !== 'admin' && conversation.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(conversation);
  } catch (err) {
    next(err);
  }
}

// POST /api/chat/conversations/:id/messages — Send a message
async function sendMessage(req, res, next) {
  try {
    const { content, options } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const conversation = await ChatConversation.findByPk(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (req.user.role !== 'admin' && conversation.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await chatService.chat(conversation.id, content.trim(), options || {});

    // Auto-generate title after 2 messages (1 user + 1 assistant = first exchange)
    const messageCount = await ChatMessage.count({ where: { conversationId: conversation.id } });
    if (messageCount === 2 && conversation.title === 'New Conversation') {
      try {
        const messages = await ChatMessage.findAll({
          where: { conversationId: conversation.id },
          order: [['created_at', 'ASC']],
          limit: 4,
        });
        const newTitle = await chatService.generateConversationTitle(messages);
        await conversation.update({ title: newTitle });
        result.conversationTitle = newTitle;
      } catch (titleErr) {
        // Non-critical — don't fail the request if title generation fails
      }
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}

// PUT /api/chat/conversations/:id/archive — Archive a conversation
async function archiveConversation(req, res, next) {
  try {
    const conversation = await ChatConversation.findByPk(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (req.user.role !== 'admin' && conversation.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await conversation.update({ status: 'archived' });
    res.json(conversation);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/chat/conversations/:id — Delete conversation and all messages
async function deleteConversation(req, res, next) {
  try {
    const conversation = await ChatConversation.findByPk(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (req.user.role !== 'admin' && conversation.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await ChatMessage.destroy({ where: { conversationId: conversation.id } });
    await conversation.destroy();

    res.json({ message: 'Conversation deleted' });
  } catch (err) {
    next(err);
  }
}

// GET /api/chat/conversations/:id/suggestions — Get suggested follow-up questions
async function getSuggestedQuestions(req, res, next) {
  try {
    const conversation = await ChatConversation.findByPk(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (req.user.role !== 'admin' && conversation.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const questions = await chatService.getSuggestedQuestions(conversation.id);

    res.json({ questions });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createConversation,
  listConversations,
  getConversation,
  sendMessage,
  archiveConversation,
  deleteConversation,
  getSuggestedQuestions,
};
