'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. rfps (standalone)
    await queryInterface.createTable('rfps', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      title: { type: Sequelize.STRING(255), allowNull: false },
      raw_input: { type: Sequelize.TEXT, allowNull: false },
      structured_data: { type: Sequelize.JSONB, allowNull: true },
      budget: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      currency: { type: Sequelize.STRING(3), defaultValue: 'USD' },
      deadline: { type: Sequelize.DATE, allowNull: true },
      delivery_days: { type: Sequelize.INTEGER, allowNull: true },
      status: {
        type: Sequelize.ENUM('draft', 'published', 'sent', 'evaluating', 'awarded', 'closed'),
        defaultValue: 'draft',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 2. vendors (standalone)
    await queryInterface.createTable('vendors', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      email: { type: Sequelize.STRING(255), allowNull: false },
      company: { type: Sequelize.STRING(255), allowNull: true },
      phone: { type: Sequelize.STRING(50), allowNull: true },
      category: { type: Sequelize.STRING(100), allowNull: true },
      address: { type: Sequelize.TEXT, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 3. rfp_vendors (FKs to rfps, vendors)
    await queryInterface.createTable('rfp_vendors', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      rfp_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'rfps', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      vendor_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'vendors', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      email_status: {
        type: Sequelize.ENUM('pending', 'sent', 'failed', 'delivered'),
        defaultValue: 'pending',
      },
      sent_at: { type: Sequelize.DATE, allowNull: true },
      email_error: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 4. proposals (FKs to rfps, vendors)
    await queryInterface.createTable('proposals', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      rfp_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'rfps', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      vendor_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'vendors', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      raw_content: { type: Sequelize.TEXT, allowNull: true },
      source_type: {
        type: Sequelize.ENUM('email', 'pdf', 'manual'),
        defaultValue: 'email',
      },
      attachments: { type: Sequelize.JSONB, allowNull: true },
      parsed_data: { type: Sequelize.JSONB, allowNull: true },
      total_price: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      score: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      status: {
        type: Sequelize.ENUM('received', 'parsing', 'parsed', 'error'),
        defaultValue: 'received',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 5. comparisons (FK to rfps)
    await queryInterface.createTable('comparisons', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      rfp_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'rfps', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      comparison_data: { type: Sequelize.JSONB, allowNull: true },
      recommendation: { type: Sequelize.JSONB, allowNull: true },
      summary: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 6. rfp_documents (standalone)
    await queryInterface.createTable('rfp_documents', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      title: { type: Sequelize.STRING(255), allowNull: true },
      original_filename: { type: Sequelize.STRING(255), allowNull: false },
      file_size: { type: Sequelize.INTEGER, allowNull: false },
      raw_text: { type: Sequelize.TEXT, allowNull: true },
      extracted_data: { type: Sequelize.JSONB, allowNull: true },
      status: {
        type: Sequelize.ENUM('uploaded', 'extracting', 'extracted', 'error'),
        defaultValue: 'uploaded',
      },
      error_message: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 7. generated_proposals (FK to rfp_documents)
    await queryInterface.createTable('generated_proposals', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      rfp_document_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'rfp_documents', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      title: { type: Sequelize.STRING(255), allowNull: true },
      company_profile: { type: Sequelize.JSONB, allowNull: true },
      proposal_content: { type: Sequelize.JSONB, allowNull: true },
      status: {
        type: Sequelize.ENUM('generating', 'generated', 'edited', 'finalized'),
        defaultValue: 'generating',
      },
      version: { type: Sequelize.INTEGER, defaultValue: 1 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 8. document_embeddings (standalone + composite index)
    await queryInterface.createTable('document_embeddings', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      source_type: {
        type: Sequelize.ENUM('rfp_document', 'generated_proposal', 'proposal', 'rfp'),
        allowNull: false,
      },
      source_id: { type: Sequelize.INTEGER, allowNull: false },
      source_title: { type: Sequelize.STRING(500), allowNull: true },
      chunk_index: { type: Sequelize.INTEGER, allowNull: false },
      chunk_text: { type: Sequelize.TEXT, allowNull: false },
      embedding: { type: Sequelize.JSONB, allowNull: false },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('document_embeddings', ['source_type', 'source_id']);

    // 9. risk_analyses (FKs to rfp_documents, generated_proposals)
    await queryInterface.createTable('risk_analyses', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      rfp_document_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'rfp_documents', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      generated_proposal_id: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'generated_proposals', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      analysis_data: { type: Sequelize.JSONB, allowNull: true },
      overall_risk_score: { type: Sequelize.INTEGER, allowNull: true },
      overall_risk_level: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'analyzing', 'completed', 'failed'),
        defaultValue: 'pending',
      },
      error_message: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 10. chat_conversations (standalone)
    await queryInterface.createTable('chat_conversations', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      title: { type: Sequelize.STRING(255), allowNull: false, defaultValue: 'New Conversation' },
      status: {
        type: Sequelize.ENUM('active', 'archived'),
        defaultValue: 'active',
      },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      last_message_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 11. chat_messages (FK to chat_conversations)
    await queryInterface.createTable('chat_messages', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      conversation_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'chat_conversations', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      role: {
        type: Sequelize.ENUM('user', 'assistant', 'system'),
        allowNull: false,
      },
      content: { type: Sequelize.TEXT, allowNull: false },
      sources: { type: Sequelize.JSONB, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    // Drop in reverse dependency order
    await queryInterface.dropTable('chat_messages');
    await queryInterface.dropTable('chat_conversations');
    await queryInterface.dropTable('risk_analyses');
    await queryInterface.dropTable('document_embeddings');
    await queryInterface.dropTable('generated_proposals');
    await queryInterface.dropTable('rfp_documents');
    await queryInterface.dropTable('comparisons');
    await queryInterface.dropTable('proposals');
    await queryInterface.dropTable('rfp_vendors');
    await queryInterface.dropTable('vendors');
    await queryInterface.dropTable('rfps');
  },
};
