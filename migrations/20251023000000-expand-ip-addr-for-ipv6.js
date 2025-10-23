'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Expand ip_addr columns to support full IPv6 addresses (up to 45 chars)
    await queryInterface.sequelize.query(
      'ALTER TABLE `stats_login_log` MODIFY COLUMN `ip_addr` VARCHAR(45) NOT NULL'
    )
    
    await queryInterface.sequelize.query(
      'ALTER TABLE `stats_session_log` MODIFY COLUMN `ip_addr` VARCHAR(45) NOT NULL'
    )
    
    console.log('Successfully expanded ip_addr columns to support IPv6')
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to CHAR(15) - will truncate any IPv6 addresses longer than 15 chars
    console.warn('WARNING: Reverting to CHAR(15) will truncate IPv6 addresses')
    
    await queryInterface.sequelize.query(
      'ALTER TABLE `stats_login_log` MODIFY COLUMN `ip_addr` CHAR(15) NOT NULL'
    )
    
    await queryInterface.sequelize.query(
      'ALTER TABLE `stats_session_log` MODIFY COLUMN `ip_addr` CHAR(15) NOT NULL'
    )
    
    console.log('Reverted ip_addr columns back to CHAR(15)')
  }
}

