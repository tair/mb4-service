import { Model } from 'sequelize'

export default class MatrixImage extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        image_id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        project_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        media: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: 'hp_matrix_images',
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
