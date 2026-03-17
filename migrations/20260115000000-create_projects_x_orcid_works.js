'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Helper to check if a table exists
    const tableExists = async (tableName) => {
      const [tables] = await queryInterface.sequelize.query(
        `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}'`
      )
      return tables.length > 0
    }

    // Helper to check if an index exists
    const indexExists = async (tableName, indexName) => {
      const [indexes] = await queryInterface.sequelize.query(
        `SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}' AND INDEX_NAME = '${indexName}'`
      )
      return indexes.length > 0
    }

    // Create projects_x_orcid_works table if it doesn't exist
    if (!(await tableExists('projects_x_orcid_works'))) {
      console.log('Creating projects_x_orcid_works table...')
      await queryInterface.createTable('projects_x_orcid_works', {
        link_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        project_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'projects',
            key: 'project_id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'RESTRICT',
        },
        user_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'ca_users',
            key: 'user_id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'RESTRICT',
        },
        orcid: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        put_code: {
          type: Sequelize.STRING(255),
          allowNull: true,
          comment: 'ORCID work put-code identifier',
        },
        status: {
          type: Sequelize.ENUM('success', 'failed'),
          allowNull: false,
          defaultValue: 'success',
        },
        error_message: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        created_on: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
        },
        updated_on: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: true,
        },
      })
    } else {
      console.log('projects_x_orcid_works table already exists, skipping...')
    }

    // Add unique constraint to prevent duplicate entries
    if (!(await indexExists('projects_x_orcid_works', 'projects_x_orcid_works_unique'))) {
      console.log('Creating projects_x_orcid_works_unique index...')
      await queryInterface.addIndex('projects_x_orcid_works', ['project_id', 'user_id'], {
        unique: true,
        name: 'projects_x_orcid_works_unique',
      })
    } else {
      console.log('projects_x_orcid_works_unique index already exists, skipping...')
    }

    // Add indexes for common queries
    if (!(await indexExists('projects_x_orcid_works', 'idx_project_id'))) {
      console.log('Creating idx_project_id index...')
      await queryInterface.addIndex('projects_x_orcid_works', ['project_id'], {
        name: 'idx_project_id',
      })
    } else {
      console.log('idx_project_id index already exists, skipping...')
    }

    if (!(await indexExists('projects_x_orcid_works', 'idx_user_id'))) {
      console.log('Creating idx_user_id index...')
      await queryInterface.addIndex('projects_x_orcid_works', ['user_id'], {
        name: 'idx_user_id',
      })
    } else {
      console.log('idx_user_id index already exists, skipping...')
    }

    if (!(await indexExists('projects_x_orcid_works', 'idx_orcid'))) {
      console.log('Creating idx_orcid index...')
      await queryInterface.addIndex('projects_x_orcid_works', ['orcid'], {
        name: 'idx_orcid',
      })
    } else {
      console.log('idx_orcid index already exists, skipping...')
    }

    if (!(await indexExists('projects_x_orcid_works', 'idx_status'))) {
      console.log('Creating idx_status index...')
      await queryInterface.addIndex('projects_x_orcid_works', ['status'], {
        name: 'idx_status',
      })
    } else {
      console.log('idx_status index already exists, skipping...')
    }

    console.log('Migration completed successfully!')
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('projects_x_orcid_works')
  },
}

