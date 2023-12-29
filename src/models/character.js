import _sequelize from 'sequelize'
import { time } from '../util/util.js'
const { Model } = _sequelize

export default class Character extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        character_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
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
        name: {
          type: DataTypes.STRING(1024),
          allowNull: false,
        },
        // TODO(kenzley): Drop this column since it is no longer used.
        num: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        // TODO(kenzley): Drop this column since this is no longer used.
        color: {
          type: DataTypes.STRING(6),
          allowNull: false,
          defaultValue: '',
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        ordering: {
          type: DataTypes.TINYINT,
          allowNull: true,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                0, // Unordered
                1, // Ordered
                2, // Irreversible
                3, // Dollo
                10, // User-defined
              ],
            ],
          },
        },
        order_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        type: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                0, // Discrete
                1, // Continuous
                2, // Meristic
              ],
            ],
          },
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: '',
        },
        access: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                0, // Anyone may edit this character
                1, // Only the owner may edit this character
              ],
            ],
          },
        },
        last_modified_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
          shouldLog: false,
        },
        created_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
          shouldLog: false,
        },
        ancestor_character_id: {
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
        tableName: 'characters',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'character_id' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'i_name',
            using: 'BTREE',
            fields: [{ name: 'name', length: 767 }],
          },
          {
            name: 'fk_characters_project_id',
            using: 'BTREE',
            fields: [{ name: 'project_id' }],
          },
        ],
      }
    )
  }
}
