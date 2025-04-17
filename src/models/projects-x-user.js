import _sequelize from 'sequelize'
import { time } from '../util/util.js'
const { Model } = _sequelize

// Membership type enum
export const MembershipType = {
  ADMIN: 0, // ADMIN membership (can edit everything)
  OBSERVER: 1, // Observer (cannot edit)
  CHARACTER_ANNOTATOR: 2, // Character annotater (can edit characters and states only)
  BIBLIOGRAPHY_MAINTAINER: 3, // Bibliography maintainer (can edit bibliography only)
}

export default class ProjectsXUser extends Model {
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
          defaultValue: 0,
          references: {
            model: 'projects',
            key: 'project_id',
          },
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        created_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
        },
        membership_type: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: MembershipType.ADMIN,
          validate: {
            isIn: [
              [
                MembershipType.ADMIN,
                MembershipType.OBSERVER,
                MembershipType.CHARACTER_ANNOTATOR,
                MembershipType.BIBLIOGRAPHY_MAINTAINER,
              ],
            ],
          },
        },
        last_accessed_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        color: {
          type: DataTypes.STRING(6),
          allowNull: false,
          defaultValue: '',
        },
        vars: {
          type: DataTypes.JSON,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'projects_x_users',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'link_id' }],
          },
          {
            name: 'u_project_user_id',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'project_id' }, { name: 'user_id' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'i_created_on',
            using: 'BTREE',
            fields: [{ name: 'created_on' }],
          },
          {
            name: 'fk_projects_x_users_project_id',
            using: 'BTREE',
            fields: [{ name: 'project_id' }],
          },
        ],
      }
    )
  }

  getVar(key) {
    return this.var ? this.vars[key] : null
  }

  setVar(key, value) {
    if (this.vars == null) {
      this.vars = {}
    }
    this.vars[key] = value
    this.changed('vars', true)
  }

  getPreferences(preference) {
    preference = preference.toLowerCase()
    const preferences = this.getVar('_project_preferences')
    if (preferences && preference in preferences) {
      return preferences[preference]
    }
    return null
  }

  setPreferences(preference, value) {
    preference = preference.toLowerCase()
    let preferences = this.getVar('_project_preferences')
    if (preferences == null) {
      preferences = {}
    }
    preferences[preference] = value
    this.setVar('_project_preferences', preferences)
  }
}
