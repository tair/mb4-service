import _sequelize from 'sequelize'
import { time } from '../util/util.js'
const { Model } = _sequelize

export default class CurationRequest extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        request_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        request_type: {
          type: DataTypes.TINYINT,
          allowNull: false,
        },
        status: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        created_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
        },
        completed_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        table_num: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
        },
        row_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
        },
        parameters: {
          type: DataTypes.JSON,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'curation_requests',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'request_id' }],
          },
        ],
      }
    )
  }
}
