'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ca_task_queue', 'started_on', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      after: 'created_on',
    })
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('ca_task_queue', 'started_on')
  },
}
