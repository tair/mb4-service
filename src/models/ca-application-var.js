import { Model } from 'sequelize'

export default class CaApplicationVar extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        vars: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: 'ca_application_vars',
        timestamps: false,
        freezeTableName: true,
        hasTrigger: false,
        primaryKey: false,
      }
    )
  }
}
