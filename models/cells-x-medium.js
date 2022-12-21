import _sequelize from 'sequelize'
import { time } from '../util/util.js'
const { Model } = _sequelize

export default class CellsXMedium extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        link_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        media_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          references: {
            model: 'media_files',
            key: 'media_id',
          },
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: '',
        },
        taxon_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          references: {
            model: 'taxa',
            key: 'taxon_id',
          },
        },
        character_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          references: {
            model: 'characters',
            key: 'character_id',
          },
        },
        matrix_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          references: {
            model: 'matrices',
            key: 'matrix_id',
          },
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        created_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
        },
        ancestor_link_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          ancestored: true,
        },
        set_by_automation: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        source: {
          type: DataTypes.STRING(40),
          allowNull: false,
          defaultValue: '',
        },
      },
      {
        sequelize,
        tableName: 'cells_x_media',
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
            unique: true,
            using: 'BTREE',
            fields: [
              { name: 'media_id' },
              { name: 'character_id' },
              { name: 'taxon_id' },
              { name: 'matrix_id' },
            ],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'fk_cells_x_media_matrix_id',
            using: 'BTREE',
            fields: [{ name: 'matrix_id' }],
          },
          {
            name: 'fk_cells_x_media_taxon_id',
            using: 'BTREE',
            fields: [{ name: 'taxon_id' }],
          },
          {
            name: 'fk_cells_x_media_character_id',
            using: 'BTREE',
            fields: [{ name: 'character_id' }],
          },
        ],
      }
    )
  }

  generateCellSnapshot() {
    return { notes: this.notes, media_id: this.media_id }
  }
}
