import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class ProjectMembersXGroup extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    link_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      primaryKey: true
    },
    membership_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'projects_x_users',
        key: 'link_id'
      }
    },
    group_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'project_member_groups',
        key: 'group_id'
      }
    }
  }, {
    sequelize,
    tableName: 'project_members_x_groups',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "link_id" },
        ]
      },
      {
        name: "u_all",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "membership_id" },
          { name: "group_id" },
        ]
      },
      {
        name: "fk_project_members_x_groups_group_id",
        using: "BTREE",
        fields: [
          { name: "group_id" },
        ]
      },
    ]
  });
  }
}
