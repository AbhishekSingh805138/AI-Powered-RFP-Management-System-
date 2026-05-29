const sequelize = require('../config/database');
const Rfp = require('./Rfp');
const Vendor = require('./Vendor');
const RfpVendor = require('./RfpVendor');
const Proposal = require('./Proposal');
const Comparison = require('./Comparison');
const RfpDocument = require('./RfpDocument');
const GeneratedProposal = require('./GeneratedProposal');
const DocumentEmbedding = require('./DocumentEmbedding');
const RiskAnalysis = require('./RiskAnalysis');
const ChatConversation = require('./ChatConversation');
const ChatMessage = require('./ChatMessage');
const User = require('./User');
const Notification = require('./Notification');

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

// RfpDocument has many GeneratedProposals
RfpDocument.hasMany(GeneratedProposal, { foreignKey: 'rfp_document_id', as: 'generatedProposals' });
GeneratedProposal.belongsTo(RfpDocument, { foreignKey: 'rfp_document_id', as: 'rfpDocument' });

// RiskAnalysis belongs to RfpDocument and optionally to GeneratedProposal
RfpDocument.hasMany(RiskAnalysis, { foreignKey: 'rfp_document_id', as: 'riskAnalyses' });
RiskAnalysis.belongsTo(RfpDocument, { foreignKey: 'rfp_document_id', as: 'rfpDocument' });
GeneratedProposal.hasMany(RiskAnalysis, { foreignKey: 'generated_proposal_id', as: 'riskAnalyses' });
RiskAnalysis.belongsTo(GeneratedProposal, { foreignKey: 'generated_proposal_id', as: 'generatedProposal' });

// ChatConversation has many ChatMessages
ChatConversation.hasMany(ChatMessage, { foreignKey: 'conversation_id', as: 'messages' });
ChatMessage.belongsTo(ChatConversation, { foreignKey: 'conversation_id', as: 'conversation' });

// User associations
User.hasMany(Rfp, { foreignKey: 'user_id', as: 'rfps' });
Rfp.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(Vendor, { foreignKey: 'user_id', as: 'vendors' });
Vendor.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(RfpDocument, { foreignKey: 'user_id', as: 'rfpDocuments' });
RfpDocument.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(ChatConversation, { foreignKey: 'user_id', as: 'chatConversations' });
ChatConversation.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Notification associations
User.hasMany(Notification, { foreignKey: 'recipient_id', as: 'notifications', constraints: false, scope: { recipient_type: 'user' } });

module.exports = {
  sequelize,
  Rfp,
  Vendor,
  RfpVendor,
  Proposal,
  Comparison,
  RfpDocument,
  GeneratedProposal,
  DocumentEmbedding,
  RiskAnalysis,
  ChatConversation,
  ChatMessage,
  User,
  Notification,
};
