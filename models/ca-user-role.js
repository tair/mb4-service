import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class CaUserRole extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    role_id: {
      autoIncrement: true,
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: "u_name"
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: "u_code"
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    vars: {
      type: DataTypes.JSON,
      allowNull: true
    },
    field_access: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'ca_user_roles',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "role_id" },
        ]
      },
      {
        name: "u_name",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "name" },
        ]
      },
      {
        name: "u_code",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "code" },
        ]
      },
    ]
  });
  }
}
