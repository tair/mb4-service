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

    // Create composite_taxa table if it doesn't exist
    if (!(await tableExists('composite_taxa'))) {
      console.log('Creating composite_taxa table...')
      await queryInterface.createTable('composite_taxa', {
        composite_taxon_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        taxon_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'taxa',
            key: 'taxon_id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          comment: 'The composite taxon row in the matrix',
        },
        matrix_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'matrices',
            key: 'matrix_id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        name: {
          type: Sequelize.STRING(255),
          allowNull: false,
          comment: 'User-provided name for the composite taxon',
        },
        user_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'ca_users',
            key: 'user_id',
          },
          onDelete: 'RESTRICT',
          onUpdate: 'CASCADE',
          comment: 'Creator of the composite taxon',
        },
        created_on: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
        },
        last_modified_on: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
        },
      })
    } else {
      console.log('composite_taxa table already exists, skipping...')
    }

    // Add indexes for composite_taxa if they don't exist
    if (!(await indexExists('composite_taxa', 'u_taxon_id'))) {
      console.log('Creating u_taxon_id index...')
      await queryInterface.addIndex('composite_taxa', ['taxon_id'], {
        unique: true,
        name: 'u_taxon_id',
      })
    } else {
      console.log('u_taxon_id index already exists, skipping...')
    }

    if (!(await indexExists('composite_taxa', 'i_matrix_id'))) {
      console.log('Creating i_matrix_id index...')
      await queryInterface.addIndex('composite_taxa', ['matrix_id'], {
        name: 'i_matrix_id',
      })
    } else {
      console.log('i_matrix_id index already exists, skipping...')
    }

    if (!(await indexExists('composite_taxa', 'i_user_id'))) {
      console.log('Creating i_user_id index...')
      await queryInterface.addIndex('composite_taxa', ['user_id'], {
        name: 'i_user_id',
      })
    } else {
      console.log('i_user_id index already exists, skipping...')
    }

    // Create composite_taxa_sources table if it doesn't exist
    if (!(await tableExists('composite_taxa_sources'))) {
      console.log('Creating composite_taxa_sources table...')
      await queryInterface.createTable('composite_taxa_sources', {
        id: {
          type: Sequelize.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        composite_taxon_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'composite_taxa',
            key: 'composite_taxon_id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        source_taxon_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'taxa',
            key: 'taxon_id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          comment: 'Source taxon that contributes to the composite',
        },
        position: {
          type: Sequelize.SMALLINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          comment: 'Ordering of source taxa',
        },
      })
    } else {
      console.log('composite_taxa_sources table already exists, skipping...')
    }

    // Add indexes for composite_taxa_sources if they don't exist
    if (!(await indexExists('composite_taxa_sources', 'u_composite_source'))) {
      console.log('Creating u_composite_source index...')
      await queryInterface.addIndex('composite_taxa_sources', ['composite_taxon_id', 'source_taxon_id'], {
        unique: true,
        name: 'u_composite_source',
      })
    } else {
      console.log('u_composite_source index already exists, skipping...')
    }

    if (!(await indexExists('composite_taxa_sources', 'i_source_taxon_id'))) {
      console.log('Creating i_source_taxon_id index...')
      await queryInterface.addIndex('composite_taxa_sources', ['source_taxon_id'], {
        name: 'i_source_taxon_id',
      })
    } else {
      console.log('i_source_taxon_id index already exists, skipping...')
    }

    if (!(await indexExists('composite_taxa_sources', 'i_composite_position'))) {
      console.log('Creating i_composite_position index...')
      await queryInterface.addIndex('composite_taxa_sources', ['composite_taxon_id', 'position'], {
        name: 'i_composite_position',
      })
    } else {
      console.log('i_composite_position index already exists, skipping...')
    }

    console.log('Migration completed successfully!')
  },

  down: async (queryInterface, Sequelize) => {
    // Drop tables in reverse order due to foreign key constraints
    await queryInterface.dropTable('composite_taxa_sources')
    await queryInterface.dropTable('composite_taxa')
  },
}
