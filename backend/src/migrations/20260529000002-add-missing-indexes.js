'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // FK indexes — critical for JOIN performance
    await queryInterface.addIndex('rfp_vendors', ['rfp_id']);
    await queryInterface.addIndex('rfp_vendors', ['vendor_id']);
    await queryInterface.addIndex('proposals', ['rfp_id']);
    await queryInterface.addIndex('proposals', ['vendor_id']);
    await queryInterface.addIndex('comparisons', ['rfp_id']);
    await queryInterface.addIndex('generated_proposals', ['rfp_document_id']);
    await queryInterface.addIndex('risk_analyses', ['rfp_document_id']);
    await queryInterface.addIndex('risk_analyses', ['generated_proposal_id']);
    await queryInterface.addIndex('chat_messages', ['conversation_id']);

    // Status indexes — used in WHERE filters and list queries
    await queryInterface.addIndex('rfps', ['status']);
    await queryInterface.addIndex('proposals', ['status']);
    await queryInterface.addIndex('rfp_documents', ['status']);
    await queryInterface.addIndex('generated_proposals', ['status']);
    await queryInterface.addIndex('risk_analyses', ['status']);
    await queryInterface.addIndex('chat_conversations', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('rfp_vendors', ['rfp_id']);
    await queryInterface.removeIndex('rfp_vendors', ['vendor_id']);
    await queryInterface.removeIndex('proposals', ['rfp_id']);
    await queryInterface.removeIndex('proposals', ['vendor_id']);
    await queryInterface.removeIndex('comparisons', ['rfp_id']);
    await queryInterface.removeIndex('generated_proposals', ['rfp_document_id']);
    await queryInterface.removeIndex('risk_analyses', ['rfp_document_id']);
    await queryInterface.removeIndex('risk_analyses', ['generated_proposal_id']);
    await queryInterface.removeIndex('chat_messages', ['conversation_id']);

    await queryInterface.removeIndex('rfps', ['status']);
    await queryInterface.removeIndex('proposals', ['status']);
    await queryInterface.removeIndex('rfp_documents', ['status']);
    await queryInterface.removeIndex('generated_proposals', ['status']);
    await queryInterface.removeIndex('risk_analyses', ['status']);
    await queryInterface.removeIndex('chat_conversations', ['status']);
  },
};
