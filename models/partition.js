import _sequelize from 'sequelize';
const { Model } = _sequelize;

export default class Partition extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    partition_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: ""
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    project_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      references: {
        model: 'projects',
        key: 'project_id'
      }
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    },
    source: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: ""
    }
  }, {
    sequelize,
    tableName: 'partitions',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "partition_id" },
        ]
      },
      {
        name: "u_all",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "name" },
          { name: "project_id" },
        ]
      },
      {
        name: "i_user_id",
        using: "BTREE",
        fields: [
          { name: "user_id" },
        ]
      },
      {
        name: "fk_partitions_project_id",
        using: "BTREE",
        fields: [
          { name: "project_id" },
        ]
      },
    ]
  });
  }
}
