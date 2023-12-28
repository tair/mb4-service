import _sequelize from 'sequelize'
import { time } from '../util/util.js'
const { Model } = _sequelize

export default class InstitutionsXUser extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        link_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'ca_users',
            key: 'user_id',
          },
        },
        institution_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'institutions',
            key: 'institution_id',
          },
        },
        created_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
        },
      },
      {
        sequelize,
        tableName: 'institutions_x_users',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'link_id' }],
          },
          {
            name: 'user_x_institution_unique',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'user_id' }, { name: 'institution_id' }],
          },
          {
            name: 'institution_id',
            using: 'BTREE',
            fields: [{ name: 'institution_id' }],
          },
        ],
      }
    )
  }
}
