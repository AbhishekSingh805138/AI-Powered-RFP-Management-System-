const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RfpVendor = sequelize.define('RfpVendor', {
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
  emailStatus: {
    type: DataTypes.ENUM('pending', 'sent', 'failed', 'delivered'),
    defaultValue: 'pending',
    field: 'email_status',
  },
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'sent_at',
  },
  emailError: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'email_error',
  },
}, {
  tableName: 'rfp_vendors',
  underscored: true,
  timestamps: true,
});

module.exports = RfpVendor;
