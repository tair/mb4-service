import _sequelize from 'sequelize'
const { Model } = _sequelize

export default class ProjectMemberGroup extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        group_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        project_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'projects',
            key: 'project_id',
          },
        },
        group_name: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        color: {
          type: DataTypes.CHAR(6),
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: 'project_member_groups',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'group_id' }],
          },
          {
            name: 'u_project_group_name',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'project_id' }, { name: 'group_name' }],
          },
        ],
      }
    )
  }
}
