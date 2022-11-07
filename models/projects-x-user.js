import _sequelize from 'sequelize'
const { Model, Sequelize } = _sequelize

export default class ProjectsXUser extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        link_id: {
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
        created_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        membership_type: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        last_accessed_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        color: {
          type: DataTypes.STRING(6),
          allowNull: false,
          defaultValue: '',
        },
        vars: {
          type: DataTypes.JSON,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'projects_x_users',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'link_id' }],
          },
          {
            name: 'u_project_user_id',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'project_id' }, { name: 'user_id' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'i_created_on',
            using: 'BTREE',
            fields: [{ name: 'created_on' }],
          },
          {
            name: 'fk_projects_x_users_project_id',
            using: 'BTREE',
            fields: [{ name: 'project_id' }],
          },
        ],
      }
    )
  }
}
