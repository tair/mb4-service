import _sequelize from 'sequelize'
import { time } from '../util/util.js'
const { Model } = _sequelize

export default class CellNote extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        note_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
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
        character_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          references: {
            model: 'characters',
            key: 'character_id',
          },
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
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
        },
        created_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
          shouldLog: false,
        },
        last_modified_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
          shouldLog: false,
        },
        notes: {
          type: DataTypes.TEXT,
          // TODO(kenzley): We should consider making this null. Currently, this
          // is set to the empty string when it can be easily set as null.
          allowNull: false,
        },
        status: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          validate: {
            isIn: [
              [
                0, // New
                50, // In Progress
                100, // Complete
              ],
            ],
          },
        },
        ancestor_note_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          ancestored: true,
        },
        source: {
          type: DataTypes.STRING(40),
          allowNull: false,
          defaultValue: '',
        },
      },
      {
        sequelize,
        tableName: 'cell_notes',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'note_id' }],
          },
          {
            name: 'u_all',
            unique: true,
            using: 'BTREE',
            fields: [
              { name: 'matrix_id' },
              { name: 'character_id' },
              { name: 'taxon_id' },
            ],
          },
          {
            name: 'fk_cell_notes_taxon_id',
            using: 'BTREE',
            fields: [{ name: 'taxon_id' }],
          },
          {
            name: 'fk_cell_notes_character_id',
            using: 'BTREE',
            fields: [{ name: 'character_id' }],
          },
        ],
        hooks: {
          beforeUpdate: (cellNote) => {
            cellNote.last_modified_on = time()
          },
        },
      }
    )
  }

  generateCellSnapshot(changeType) {
    switch (changeType) {
      case 'I':
      case 'D':
        return { notes: this.notes, status: this.status }
      case 'U': {
        const snapshot = {}
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
