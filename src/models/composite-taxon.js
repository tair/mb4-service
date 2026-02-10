import _sequelize from 'sequelize'
import { time } from '../util/util.js'
const { Model } = _sequelize

export default class CompositeTaxon extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        composite_taxon_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        taxon_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'taxa',
            key: 'taxon_id',
          },
          comment: 'The composite taxon row in the matrix',
        },
        matrix_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'matrices',
            key: 'matrix_id',
          },
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false,
          comment: 'User-provided name for the composite taxon',
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'ca_users',
            key: 'user_id',
          },
          comment: 'Creator of the composite taxon',
        },
        created_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
        },
        last_modified_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
        },
      },
      {
        sequelize,
        tableName: 'composite_taxa',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'composite_taxon_id' }],
          },
          {
            name: 'u_taxon_id',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'taxon_id' }],
          },
          {
            name: 'i_matrix_id',
            using: 'BTREE',
            fields: [{ name: 'matrix_id' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
        ],
        hooks: {
          beforeUpdate: (record) => {
            record.last_modified_on = time()
          },
        },
      }
    )
  }
}

