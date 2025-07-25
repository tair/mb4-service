import _sequelize from 'sequelize'
import { time } from '../util/util.js'
const { Model } = _sequelize

export default class CharacterOrdering extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        order_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        title: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        order_type: {
          type: DataTypes.TINYINT,
          allowNull: false,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                0, // Step Matrix
                1, // CS Tree
              ],
            ],
          },
        },
        step_matrix: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
        },
        matrix_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'matrices',
            key: 'matrix_id',
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
        tableName: 'character_orderings',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'order_id' }],
          },
          {
            name: 'fk_character_orderings_project_id',
            using: 'BTREE',
            fields: [{ name: 'matrix_id' }],
          },
        ],
        hooks: {
          beforeUpdate: (characterOrdering) => {
            characterOrdering.last_modified_on = time()
          },
        },
      }
    )
  }
}
