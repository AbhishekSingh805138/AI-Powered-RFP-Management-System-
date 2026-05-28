const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ChatConversation = sequelize.define('ChatConversation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: 'New Conversation',
  },
  status: {
    type: DataTypes.ENUM('active', 'archived'),
    defaultValue: 'active',
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Optional metadata: linked documentIds, messageCount, etc.',
  },
  lastMessageAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_message_at',
  },
}, {
  tableName: 'chat_conversations',
  underscored: true,
  timestamps: true,
});

module.exports = ChatConversation;
