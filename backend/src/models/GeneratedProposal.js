const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GeneratedProposal = sequelize.define('GeneratedProposal', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  rfpDocumentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'rfp_document_id',
    references: { model: 'rfp_documents', key: 'id' },
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  companyProfile: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'company_profile',
    comment: 'Company info used for generation: name, expertise, experience, certifications',
  },
  proposalContent: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'proposal_content',
    comment: 'AI-generated proposal sections: executive_summary, technical_approach, scope, timeline, cost_breakdown, etc.',
  },
  status: {
    type: DataTypes.ENUM('generating', 'generated', 'edited', 'finalized'),
    defaultValue: 'generating',
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
}, {
  tableName: 'generated_proposals',
  underscored: true,
  timestamps: true,
});

module.exports = GeneratedProposal;
