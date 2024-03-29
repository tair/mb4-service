import _sequelize from 'sequelize'
import { time } from '../util/util.js'
const { Model } = _sequelize

export default class MatrixFileUpload extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        upload_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        upload: {
          type: DataTypes.JSON,
          allowNull: true,
          file: true,
          volume: 'matrices',
        },
        // TODO(kenzley): Drop this column since this is no longer used.
        comments: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: '',
        },
        item_note: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        matrix_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          references: {
            model: 'matrices',
            key: 'matrix_id',
          },
        },
        uploaded_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
        },
        matrix_note: {
          type: DataTypes.TEXT,
          allowNull: false,
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
        format: {
          type: DataTypes.STRING(40),
          allowNull: false,
          defaultValue: '',
        },
      },
      {
        sequelize,
        tableName: 'matrix_file_uploads',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'upload_id' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'fk_matrix_file_uploads_matrix_id',
            using: 'BTREE',
            fields: [{ name: 'matrix_id' }],
          },
        ],
      }
    )
  }
}
