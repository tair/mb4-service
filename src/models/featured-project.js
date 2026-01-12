import { Model } from 'sequelize'

export default class FeaturedProject extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        featured_project_id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        project_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          unique: true,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        created_on: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'hp_featured_projects',
        timestamps: false,
      }
    )
  }

  static associate(models) {
    this.belongsTo(models.Project, {
      foreignKey: 'project_id',
      as: 'project',
    })
  }
}

