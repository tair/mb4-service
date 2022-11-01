import _sequelize from 'sequelize'
const { Model, Sequelize } = _sequelize

export default class MediaView extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        view_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        project_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          references: {
            model: 'projects',
            key: 'project_id',
          },
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        ancestor_view_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'media_views',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'view_id' }],
          },
          {
            name: 'u_view',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'project_id' }, { name: 'name' }],
          },
          {
            name: 'i_name',
            using: 'BTREE',
            fields: [{ name: 'name' }],
          },
        ],
      }
    )
  }
}
