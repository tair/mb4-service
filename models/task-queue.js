import _sequelize from 'sequelize';
const { Model } = _sequelize;

export default class TaskQueue extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    task_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    row_key: {
      type: DataTypes.CHAR(32),
      allowNull: true
    },
    entity_key: {
      type: DataTypes.CHAR(32),
      allowNull: true
    },
    status: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    },
    created_on: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    completed_on: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    priority: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false
    },
    handler: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    parameters: {
      type: DataTypes.JSON,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    error_code: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    sequelize,
    tableName: 'ca_task_queue',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "task_id" },
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
        name: "i_entity_key",
        using: "BTREE",
        fields: [
          { name: "entity_key" },
        ]
      },
      {
        name: "i_row_key",
        using: "BTREE",
        fields: [
          { name: "row_key" },
        ]
      },
      {
        name: "i_status_priority",
        using: "BTREE",
        fields: [
          { name: "status" },
          { name: "priority" },
        ]
      },
    ]
  });
  }
}
