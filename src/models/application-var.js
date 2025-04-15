import { Model } from 'sequelize'

export default class ApplicationVar extends Model {
  static init(sequelize, DataTypes) {
    return super.init({
      name: {
        type: DataTypes.STRING,
        primaryKey: true
      },
      value: {
        type: DataTypes.TEXT,
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'application_vars',
      timestamps: false
    })
  }
} 