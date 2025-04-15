import { Model } from 'sequelize'

export default class Announcement extends Model {
  static init(sequelize, DataTypes) {
    return super.init({
      announcement_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      link: {
        type: DataTypes.STRING,
        allowNull: true
      },
      sdate: {
        type: DataTypes.DATE,
        allowNull: false
      },
      edate: {
        type: DataTypes.DATE,
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'hp_announcements',
      timestamps: false
    })
  }
} 