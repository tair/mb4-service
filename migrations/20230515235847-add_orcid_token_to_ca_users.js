'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ca_users', 'orcid_access_token', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
      shouldLog: false,
    })
    await queryInterface.addColumn('ca_users', 'orcid_refresh_token', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
      shouldLog: false,
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('ca_users', 'orcid_access_token')
    await queryInterface.removeColumn('ca_users', 'orcid_refresh_token')
  },
}
