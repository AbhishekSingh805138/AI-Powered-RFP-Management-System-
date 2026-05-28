const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ChatMessage = sequelize.define('ChatMessage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  conversationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'conversation_id',
    references: { model: 'chat_conversations', key: 'id' },
  },
  role: {
    type: DataTypes.ENUM('user', 'assistant', 'system'),
    allowNull: false,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  sources: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'RAG source citations: [{sourceType, sourceId, sourceTitle, chunkText, similarity}]',
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Response metadata: tokens used, model, response time',
  },
}, {
  tableName: 'chat_messages',
  underscored: true,
  timestamps: true,
});

module.exports = ChatMessage;
