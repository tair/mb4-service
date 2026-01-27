'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create composite_taxa table - stores composite taxon metadata
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

    // Add indexes for composite_taxa
    await queryInterface.addIndex('composite_taxa', ['taxon_id'], {
      unique: true,
      name: 'u_taxon_id',
    })

    await queryInterface.addIndex('composite_taxa', ['matrix_id'], {
      name: 'i_matrix_id',
    })

    await queryInterface.addIndex('composite_taxa', ['user_id'], {
      name: 'i_user_id',
    })

    // Create composite_taxa_sources table - links composite to source taxa
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

    // Add indexes for composite_taxa_sources
    await queryInterface.addIndex('composite_taxa_sources', ['composite_taxon_id', 'source_taxon_id'], {
      unique: true,
      name: 'u_composite_source',
    })

    await queryInterface.addIndex('composite_taxa_sources', ['source_taxon_id'], {
      name: 'i_source_taxon_id',
    })

    await queryInterface.addIndex('composite_taxa_sources', ['composite_taxon_id', 'position'], {
      name: 'i_composite_position',
    })
  },

  down: async (queryInterface, Sequelize) => {
    // Drop tables in reverse order due to foreign key constraints
    await queryInterface.dropTable('composite_taxa_sources')
    await queryInterface.dropTable('composite_taxa')
  },
}

