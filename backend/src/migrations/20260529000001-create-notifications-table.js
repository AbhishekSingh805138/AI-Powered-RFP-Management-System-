'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Notification type: rfp-sent, proposal-received, status-changed, risk-complete, extraction-complete',
      },
      recipient_email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      recipient_type: {
        type: Sequelize.ENUM('user', 'vendor'),
        allowNull: false,
      },
      recipient_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'User or Vendor ID',
      },
      entity_type: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Related entity: rfp, proposal, rfp_document, risk_analysis',
      },
      entity_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      subject: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('queued', 'sent', 'failed'),
        defaultValue: 'queued',
      },
      error: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Additional context: messageId, template data, etc.',
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // Indexes for common query patterns
    await queryInterface.addIndex('notifications', ['recipient_id']);
    await queryInterface.addIndex('notifications', ['type']);
    await queryInterface.addIndex('notifications', ['status']);
    await queryInterface.addIndex('notifications', ['entity_type', 'entity_id']);
    await queryInterface.addIndex('notifications', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
  },
};
