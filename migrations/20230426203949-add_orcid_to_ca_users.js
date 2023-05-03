'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ca_users', 'orcid', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
      shouldLog: false
    });

    // Add an index for the orcid column
    await queryInterface.addIndex('ca_users', ['orcid'], {
      name: 'u_orcid'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('ca_users', 'orcid');
  }
};