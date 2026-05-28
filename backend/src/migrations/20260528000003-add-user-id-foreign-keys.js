'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = ['rfps', 'vendors', 'rfp_documents', 'chat_conversations'];

    for (const table of tables) {
      await queryInterface.addColumn(table, 'user_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
      await queryInterface.addIndex(table, ['user_id']);
    }
  },

  async down(queryInterface) {
    const tables = ['chat_conversations', 'rfp_documents', 'vendors', 'rfps'];

    for (const table of tables) {
      await queryInterface.removeColumn(table, 'user_id');
    }
  },
};
