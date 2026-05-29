const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Rfp = sequelize.define('Rfp', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  rawInput: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'raw_input',
  },
  structuredData: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'structured_data',
    comment: 'AI-parsed structured RFP data: items, budget, timeline, terms',
  },
  budget: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD',
  },
  deadline: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  deliveryDays: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'delivery_days',
  },
  status: {
    type: DataTypes.ENUM('draft', 'published', 'sent', 'evaluating', 'awarded', 'closed'),
    defaultValue: 'draft',
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'user_id',
    references: { model: 'users', key: 'id' },
  },
}, {
  tableName: 'rfps',
  underscored: true,
  timestamps: true,
});

module.exports = Rfp;
