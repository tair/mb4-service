import _sequelize from 'sequelize'
import { time } from '../util/util.js'
const { Model } = _sequelize

export default class ProjectDuplicationRequest extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        request_id: {
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
        request_remarks: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        onetime_use_action: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: true,
          validate: {
            isIn: [
              [
                1, // Keep onetime use media in existing project
                100, // Move onetime use media to new project
              ],
            ],
          },
        },
        status: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 1,
          validate: {
            isIn: [
              [
                1, // Newly Submitted
                50, // Approved
                100, // Completed
                200, // Denied
              ],
            ],
          },
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        new_project_number: {
          type: DataTypes.STRING(25),
          allowNull: false,
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
        },
        created_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
        },
      },
      {
        sequelize,
        tableName: 'project_duplication_requests',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'request_id' }],
          },
          {
            name: 'i_request_id',
            using: 'BTREE',
            fields: [{ name: 'request_id' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'fk_project_duplication_requests_project_id',
            using: 'BTREE',
            fields: [{ name: 'project_id' }],
          },
        ],
      }
    )
  }
}
