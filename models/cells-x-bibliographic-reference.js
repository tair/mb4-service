import _sequelize from 'sequelize'
const { Model } = _sequelize

export default class CellsXBibliographicReference extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        link_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        reference_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'bibliographic_references',
            key: 'reference_id',
          },
        },
        pp: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        character_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'characters',
            key: 'character_id',
          },
        },
        taxon_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'taxa',
            key: 'taxon_id',
          },
        },
        matrix_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'matrices',
            key: 'matrix_id',
          },
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        source: {
          type: DataTypes.STRING(40),
          allowNull: false,
          defaultValue: '',
        },
      },
      {
        sequelize,
        tableName: 'cells_x_bibliographic_references',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'link_id' }],
          },
          {
            name: 'u_all',
            using: 'BTREE',
            fields: [
              { name: 'taxon_id' },
              { name: 'character_id' },
              { name: 'matrix_id' },
            ],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'fk_cells_x_bibliographic_references_reference_id',
            using: 'BTREE',
            fields: [{ name: 'reference_id' }],
          },
          {
            name: 'fk_cells_x_bibliographic_references_matrix_id',
            using: 'BTREE',
            fields: [{ name: 'matrix_id' }],
          },
          {
            name: 'fk_cells_x_bibliographic_references_character_id',
            using: 'BTREE',
            fields: [{ name: 'character_id' }],
          },
        ],
      }
    )
  }

  generateCellSnapshot(changeType) {
    switch (changeType) {
      case 'I':
      case 'D':
        return {
          notes: this.notes,
          pp: this.pp,
          reference_id: this.reference_id,
        }
      case 'U': {
        const snapshot = { reference_id: this.reference_id }
        for (const field of Object.keys(this.rawAttributes)) {
          if (this.changed(field)) {
            snapshot[field] = this.previous(field)
          }
        }
        return snapshot
      }
    }
  }
}
