const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Comparison = sequelize.define('Comparison', {
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
  comparisonData: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'comparison_data',
    comment: 'Detailed comparison matrix with per-vendor scores',
  },
  recommendation: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: '{vendorId, vendorName, reasoning, confidence}',
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'AI-generated natural language summary',
  },
}, {
  tableName: 'comparisons',
  underscored: true,
  timestamps: true,
});

module.exports = Comparison;
