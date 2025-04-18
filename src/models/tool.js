import { Model } from 'sequelize'

export default class Tool extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        tool_id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        title: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        media: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        link: {
          type: DataTypes.STRING,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'hp_tools',
        timestamps: false,
      }
    )
  }

  static associate(models) {
    // Add any relationships here if needed
  }
}
