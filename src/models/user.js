import _sequelize from 'sequelize'
const { Model } = _sequelize
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import { models } from './init-models.js'

// TODO(kenzley): We store the last_login and last_logout as numbers in the vars
//     column. We should move them in their own column so that they can be easily
//     searched and updated.
export default class User extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        user_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        userclass: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                0, // Full access
                255, // Deleted
              ],
            ],
          },
        },
        password_hash: {
          type: DataTypes.STRING(60),
          allowNull: true,
          shouldLog: false,
        },
        fname: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        lname: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING(255),
          allowNull: true,
          unique: 'u_email',
          validate: {
            isEmail: true,
          },
        },
        vars: {
          type: DataTypes.JSON,
          allowNull: true,
          shouldLog: false,
        },
        // TODO(kenzley): Remove this column and consolidate all user-based
        //     preferences and variables into the vars column.
        volatile_vars: {
          type: DataTypes.JSON,
          allowNull: true,
          shouldLog: false,
        },
        active: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
        },
        confirmed_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        confirmation_key: {
          type: DataTypes.CHAR(32),
          allowNull: true,
          unique: 'u_confirmation_key',
          shouldLog: false,
        },
        approved_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        advisor_user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        last_confirmed_profile_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        accepted_terms_of_use: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        orcid: {
          type: DataTypes.STRING,
          allowNull: true,
          unique: 'u_orcid_key',
          shouldLog: false,
        },
        // by default this token is valid for 20 years
        orcid_access_token: {
          type: DataTypes.STRING,
          allowNull: true,
          unique: true,
          shouldLog: false,
        },
        orcid_refresh_token: {
          type: DataTypes.STRING,
          allowNull: true,
          unique: true,
          shouldLog: false,
        },
      },
      {
        sequelize,
        tableName: 'ca_users',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'u_confirmation_key',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'confirmation_key' }],
          },
          {
            name: 'u_email',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'email' }],
          },
          {
            name: 'u_orcid',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'orcid' }],
          },
          {
            name: 'i_userclass',
            using: 'BTREE',
            fields: [{ name: 'userclass' }],
          },
          {
            name: 'i_approved_on',
            using: 'BTREE',
            fields: [{ name: 'approved_on' }],
          },
        ],
      }
    )
  }

  getVar(key) {
    if (this.vars && key in this.vars) {
      return this.vars[key]
    }
    if (this.volatile_vars && key in this.volatile_vars) {
      return this.volatile_vars[key]
    }
    return undefined
  }

  setVar(key, value) {
    if (this.vars == null) {
      this.vars = {}
    }
    if (this.volatile_vars == null) {
      this.volatile_vars = {}
    }
    this.vars[key] = value
    this.volatile_vars[key] = value
    this.changed('vars', true)
    this.changed('volatile_vars', true)
  }

  getName() {
    return this.fname + ' ' + this.lname
  }

  getLastLogout() {
    const lastLogout = this.getVar('morphobank3_last_logout') ?? 0
    return parseInt(lastLogout)
  }

  static getName(fname, lname) {
    return fname + ' ' + lname
  }

  static md5HashPassword(password) {
    return crypto.createHash('md5').update(password).digest('hex')
  }

  static hashPassword(password) {
    const md5Password = User.md5HashPassword(password)
    return bcrypt.hash(md5Password, 10)
  }

  // static method to validate a raw password against a stored hash
  static async validatePassword(password, storedPassword) {
    const md5Password = User.md5HashPassword(password)

    // The password stored in the MorphoBank database uses the password_hash
    // and password_verify methods which use the Crypt algorithm instead. To
    // make this compatible with the Bcrypt algorithm, we replace the algorithm
    // part of the string, as suggested by:
    // https://stackoverflow.com/questions/23015043
    const storedPasswordHash = storedPassword.replace('$2y$', '$2a$')

    const passwordMatch = await bcrypt.compare(md5Password, storedPasswordHash)
    return passwordMatch
  }

  // validate a raw password for the current user
  async validatePassword(password) {
    return await this.constructor.validatePassword(password, this.password_hash)
  }

  getResetPasswordKey() {
    // Concatenate userId and passwordHash with '/'
    const resetKey = `${this.user_id}/${this.password_hash || ''}`
    return User.md5HashPassword(resetKey)
  }

  async getAccess() {
    // Use the association 'ca_users_x_roles' defined in init-models.js
    const userRoleLinks = await this.getCa_users_x_roles({
      // Include the associated UserRole model using the alias 'role'
      include: [{
        model: models.UserRole,
        as: 'role',
        attributes: ['code'], // Only select the 'code' attribute
        required: true // Ensures an INNER JOIN like the original query
      }],
      attributes: [] // We don't need any attributes from the join table itself
    });

    // Map the results to extract the role code from the included 'role' object
    return userRoleLinks.map(link => link.role.code);
  }
}
