import _sequelize from 'sequelize'
import { time } from '../util/util.js'
const { Model } = _sequelize

export default class Annotation extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        annotation_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        table_num: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        row_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        typecode: {
          type: DataTypes.CHAR(1),
          allowNull: false,
          defaultValue: '',
          validate: {
            isIn: [
              [
                'C', // Comment
                'O', // Observation
              ],
            ],
          },
        },
        annotation: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        created_on: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: time,
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        specifier_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        subspecifier_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'annotations',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'annotation_id' }],
          },
          {
            name: 'i_row_id',
            using: 'BTREE',
            fields: [{ name: 'row_id' }],
          },
          {
            name: 'i_row',
            using: 'BTREE',
            fields: [{ name: 'table_num' }, { name: 'row_id' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
        ],
      }
    )
  }
}
