const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RiskAnalysis = sequelize.define('RiskAnalysis', {
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
  generatedProposalId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'generated_proposal_id',
    references: { model: 'generated_proposals', key: 'id' },
    comment: 'Optional — if provided, risk is assessed against this proposal',
  },
  analysisData: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'analysis_data',
    comment: 'AI-generated risk assessment: categories, scores, matrix, risk items, recommendations',
  },
  overallRiskScore: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'overall_risk_score',
    comment: 'Aggregate risk score 0-100 (higher = riskier)',
  },
  overallRiskLevel: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    allowNull: true,
    field: 'overall_risk_level',
  },
  status: {
    type: DataTypes.ENUM('pending', 'analyzing', 'completed', 'failed'),
    defaultValue: 'pending',
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_message',
  },
}, {
  tableName: 'risk_analyses',
  underscored: true,
  timestamps: true,
});

module.exports = RiskAnalysis;
