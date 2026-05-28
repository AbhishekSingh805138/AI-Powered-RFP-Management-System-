const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DocumentEmbedding = sequelize.define('DocumentEmbedding', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  sourceType: {
    type: DataTypes.ENUM('rfp_document', 'generated_proposal', 'proposal', 'rfp'),
    allowNull: false,
    field: 'source_type',
    comment: 'Type of document this chunk came from',
  },
  sourceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'source_id',
    comment: 'ID of the source record',
  },
  sourceTitle: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'source_title',
  },
  chunkIndex: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'chunk_index',
  },
  chunkText: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'chunk_text',
  },
  embedding: {
    type: DataTypes.JSONB,
    allowNull: false,
    comment: 'OpenAI embedding vector stored as JSON array of floats',
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Additional metadata: section name, page number, etc.',
  },
}, {
  tableName: 'document_embeddings',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['source_type', 'source_id'] },
  ],
});

module.exports = DocumentEmbedding;
