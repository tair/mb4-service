import { Model } from 'sequelize'

export default class Press extends Model {
  static init(sequelize, DataTypes) {
    return super.init({
      press_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false
      },
      author: {
        type: DataTypes.STRING,
        allowNull: true
      },
      publication: {
        type: DataTypes.STRING,
        allowNull: true
      },
      media: {
        type: DataTypes.STRING,
        allowNull: true
      },
      link: {
        type: DataTypes.STRING,
        allowNull: true
      },
      featured: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    }, {
      sequelize,
      tableName: 'press',
      timestamps: false
    })
  }

  static associate(models) {
    // Add any relationships here if needed
  }
} 