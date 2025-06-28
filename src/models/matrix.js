import _sequelize from 'sequelize'
import { time } from '../util/util.js'
import { MATRIX_OPTIONS } from '../util/matrix.js'
const { Model } = _sequelize

export default class Matrix extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        matrix_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        title: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        // TODO(kenzley): Delete this. This no longer used.
        title_extended: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: '',
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        published: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                0, // Publish when project is published
                1, // Never publish to project
              ],
            ],
          },
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
        deleted: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        otu: {
          type: DataTypes.STRING(30),
          allowNull: false,
          validate: {
            isIn: [
              [
                'supraspecific_clade',
                'higher_taxon_class',
                'higher_taxon_subclass',
                'higher_taxon_order',
                'higher_taxon_superfamily',
                'higher_taxon_family',
                'higher_taxon_subfamily',
                'genus',
                'specific_epithet',
                'subspecific_epithet',
              ],
            ],
          },
        },
        access: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                0, // Anyone may edit this matrix
                1, // Only the owner may edit this matrix
              ],
            ],
          },
        },
        type: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                0, // Categorical
                1, // Meristic
              ],
            ],
          },
        },
        last_modified_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
          shouldLog: false,
        },
        created_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
          shouldLog: false,
        },
        other_options: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        matrix_doi: {
          type: DataTypes.STRING(32),
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'matrices',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'matrix_id' }],
          },
          {
            name: 'i_title',
            using: 'BTREE',
            fields: [{ name: 'title' }],
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
            name: 'fk_matrices_project_id',
            using: 'BTREE',
            fields: [{ name: 'project_id' }],
          },
        ],
        hooks: {
          beforeUpdate: (matrix) => {
            matrix.last_modified_on = time()
          },
        },
      }
    )
  }

  getOption(key) {
    if (this.other_options && this.other_options[key] !== undefined) {
      return this.other_options[key]
    }
    return 0 // Default value when option doesn't exist
  }

  setOption(key, value) {
    if (MATRIX_OPTIONS.includes(key)) {
      if (!this.other_options) {
        this.other_options = {}
      }
      this.other_options[key] = value
      this.changed('other_options', true)
    }
  }
}
