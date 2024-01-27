import _sequelize from 'sequelize'
import { time } from '../util/util.js'

const { Model } = _sequelize

export default class Folio extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        folio_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        project_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          references: {
            model: 'projects',
            key: 'project_id',
          },
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        published: {
          type: DataTypes.TINYINT,
          allowNull: false,
          validate: {
            isIn: [
              [
                0, // Publish when project is published
                1, // Never publish to project
              ],
            ],
          },
        },
        created_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
        },
        last_modified_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
        },
      },
      {
        sequelize,
        tableName: 'folios',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'folio_id' }],
          },
          {
            name: 'fk_folios_project_id',
            using: 'BTREE',
            fields: [{ name: 'project_id' }],
          },
        ],
      }
    )
  }
}
