const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Notification type: rfp-sent, proposal-received, status-changed, risk-complete, extraction-complete',
  },
  recipientEmail: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'recipient_email',
  },
  recipientType: {
    type: DataTypes.ENUM('user', 'vendor'),
    allowNull: false,
    field: 'recipient_type',
  },
  recipientId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'recipient_id',
    comment: 'User or Vendor ID',
  },
  entityType: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'entity_type',
    comment: 'Related entity: rfp, proposal, rfp_document, risk_analysis',
  },
  entityId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'entity_id',
  },
  subject: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('queued', 'sent', 'failed'),
    defaultValue: 'queued',
  },
  error: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Additional context: messageId, template data, etc.',
  },
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'sent_at',
  },
}, {
  tableName: 'notifications',
  underscored: true,
  timestamps: true,
});

module.exports = Notification;
