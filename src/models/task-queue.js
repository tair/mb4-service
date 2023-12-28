import _sequelize from 'sequelize'
import { time } from '../util/util.js'
const { Model } = _sequelize

export default class TaskQueue extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        task_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        // TODO(kenzley): Replace row_key and entity_key with table_num and row_id.
        row_key: {
          type: DataTypes.CHAR(32),
          allowNull: true,
        },
        entity_key: {
          type: DataTypes.CHAR(32),
          allowNull: true,
        },
        status: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                0, // Created
                1, // Processing
                2, // Completed
                3, // Failed
              ],
            ],
          },
        },
        created_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
        },
        completed_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        priority: {
          type: DataTypes.SMALLINT.UNSIGNED,
          allowNull: false,
        },
        handler: {
          type: DataTypes.STRING(20),
          allowNull: false,
        },
        parameters: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        // TODO(kenzley): Set this value to NULL. Possibly rename to 'results'
        //     and set as JSON so that so that handlers will store the results
        //     properly.
        notes: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: '',
        },
        error_code: {
          type: DataTypes.SMALLINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
      },
      {
        sequelize,
        tableName: 'ca_task_queue',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'task_id' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'i_entity_key',
            using: 'BTREE',
            fields: [{ name: 'entity_key' }],
          },
          {
            name: 'i_row_key',
            using: 'BTREE',
            fields: [{ name: 'row_key' }],
          },
          {
            name: 'i_status_priority',
            using: 'BTREE',
            fields: [{ name: 'status' }, { name: 'priority' }],
          },
        ],
      }
    )
  }
}
