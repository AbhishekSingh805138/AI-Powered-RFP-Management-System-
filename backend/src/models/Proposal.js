const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Proposal = sequelize.define('Proposal', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  rfpId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'rfp_id',
    references: { model: 'rfps', key: 'id' },
  },
  vendorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'vendor_id',
    references: { model: 'vendors', key: 'id' },
  },
  rawContent: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'raw_content',
    comment: 'Original email body or extracted text from attachment',
  },
  sourceType: {
    type: DataTypes.ENUM('email', 'pdf', 'manual'),
    defaultValue: 'email',
    field: 'source_type',
  },
  attachments: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Array of {filename, path, mimeType, extractedText}',
  },
  parsedData: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'parsed_data',
    comment: 'AI-extracted: pricing, terms, conditions, line items',
  },
  totalPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    field: 'total_price',
  },
  score: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: 'AI-generated overall score 0-100',
  },
  status: {
    type: DataTypes.ENUM('received', 'parsing', 'parsed', 'error'),
    defaultValue: 'received',
  },
}, {
  tableName: 'proposals',
  underscored: true,
  timestamps: true,
});

module.exports = Proposal;
