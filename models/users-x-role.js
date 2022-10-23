import _sequelize from 'sequelize';
const { Model } = _sequelize;

export default class UsersXRole extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    relation_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'ca_users',
        key: 'user_id'
      }
    },
    role_id: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'ca_user_roles',
        key: 'role_id'
      }
    }
  }, {
    sequelize,
    tableName: 'ca_users_x_roles',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "relation_id" },
        ]
      },
      {
        name: "u_all",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "user_id" },
          { name: "role_id" },
        ]
      },
      {
        name: "i_role_id",
        using: "BTREE",
        fields: [
          { name: "role_id" },
        ]
      },
    ]
  });
  }
}
