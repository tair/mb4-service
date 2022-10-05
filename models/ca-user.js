import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class CaUser extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    user_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      primaryKey: true
    },
    userclass: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false
    },
    password_hash: {
      type: DataTypes.STRING(60),
      allowNull: true
    },
    fname: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    lname: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: "u_email"
    },
    vars: {
      type: DataTypes.JSON,
      allowNull: true
    },
    volatile_vars: {
      type: DataTypes.JSON,
      allowNull: true
    },
    active: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false
    },
    confirmed_on: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    confirmation_key: {
      type: DataTypes.CHAR(32),
      allowNull: true,
      unique: "u_confirmation_key"
    },
    approved_on: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    advisor_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    last_confirmed_profile_on: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    accepted_terms_of_use: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    sequelize,
    tableName: 'ca_users',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "user_id" },
        ]
      },
      {
        name: "u_confirmation_key",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "confirmation_key" },
        ]
      },
      {
        name: "u_email",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "email" },
        ]
      },
      {
        name: "i_userclass",
        using: "BTREE",
        fields: [
          { name: "userclass" },
        ]
      },
      {
        name: "i_approved_on",
        using: "BTREE",
        fields: [
          { name: "approved_on" },
        ]
      },
    ]
  });
  }
}
