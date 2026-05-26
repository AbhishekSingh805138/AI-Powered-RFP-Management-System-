const sequelize = require('../config/database');
const Rfp = require('./Rfp');
const Vendor = require('./Vendor');
const RfpVendor = require('./RfpVendor');
const Proposal = require('./Proposal');
const Comparison = require('./Comparison');

// Associations

// RFP <-> Vendor (many-to-many through RfpVendor)
Rfp.belongsToMany(Vendor, { through: RfpVendor, foreignKey: 'rfp_id', otherKey: 'vendor_id', as: 'vendors' });
Vendor.belongsToMany(Rfp, { through: RfpVendor, foreignKey: 'vendor_id', otherKey: 'rfp_id', as: 'rfps' });

// Direct access to join table
Rfp.hasMany(RfpVendor, { foreignKey: 'rfp_id', as: 'rfpVendors' });
Vendor.hasMany(RfpVendor, { foreignKey: 'vendor_id', as: 'rfpVendors' });
RfpVendor.belongsTo(Rfp, { foreignKey: 'rfp_id', as: 'rfp' });
RfpVendor.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' });

// Proposal belongs to RFP and Vendor
Proposal.belongsTo(Rfp, { foreignKey: 'rfp_id', as: 'rfp' });
Proposal.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' });
Rfp.hasMany(Proposal, { foreignKey: 'rfp_id', as: 'proposals' });
Vendor.hasMany(Proposal, { foreignKey: 'vendor_id', as: 'proposals' });

// Comparison belongs to RFP
Comparison.belongsTo(Rfp, { foreignKey: 'rfp_id', as: 'rfp' });
Rfp.hasMany(Comparison, { foreignKey: 'rfp_id', as: 'comparisons' });

module.exports = {
  sequelize,
  Rfp,
  Vendor,
  RfpVendor,
  Proposal,
  Comparison,
};
