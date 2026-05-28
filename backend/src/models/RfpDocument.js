const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RfpDocument = sequelize.define('RfpDocument', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'AI-extracted title from the RFP document',
  },
  originalFilename: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'original_filename',
  },
  fileSize: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'file_size',
  },
  rawText: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'raw_text',
    comment: 'Extracted text from the PDF',
  },
  extractedData: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'extracted_data',
    comment: 'AI-extracted structured requirements: summary, deadlines, requirements, compliance, deliverables, budget, evaluation criteria',
  },
  status: {
    type: DataTypes.ENUM('uploaded', 'extracting', 'extracted', 'error'),
    defaultValue: 'uploaded',
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_message',
  },
}, {
  tableName: 'rfp_documents',
  underscored: true,
  timestamps: true,
});

module.exports = RfpDocument;
