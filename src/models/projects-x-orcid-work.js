import _sequelize from 'sequelize'
import { time } from '../util/util.js'
const { Model } = _sequelize

export default class ProjectsXOrcidWork extends Model {
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
          references: {
            model: 'projects',
            key: 'project_id',
          },
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'ca_users',
            key: 'user_id',
          },
        },
        orcid: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        put_code: {
          type: DataTypes.STRING(255),
          allowNull: true,
          comment: 'ORCID work put-code identifier',
        },
        status: {
          type: DataTypes.ENUM('success', 'failed'),
          allowNull: false,
          defaultValue: 'success',
        },
        error_message: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        created_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
        },
        updated_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'projects_x_orcid_works',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'link_id' }],
          },
          {
            name: 'projects_x_orcid_works_unique',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'project_id' }, { name: 'user_id' }],
          },
          {
            name: 'idx_project_id',
            using: 'BTREE',
            fields: [{ name: 'project_id' }],
          },
          {
            name: 'idx_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'idx_orcid',
            using: 'BTREE',
            fields: [{ name: 'orcid' }],
          },
          {
            name: 'idx_status',
            using: 'BTREE',
            fields: [{ name: 'status' }],
          },
        ],
      }
    )
  }

  static associate(models) {
    ProjectsXOrcidWork.belongsTo(models.Project, {
      foreignKey: 'project_id',
      as: 'project',
    })
    ProjectsXOrcidWork.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    })
  }
}

