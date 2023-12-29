import _sequelize from 'sequelize'
const { Model } = _sequelize

export default class MatrixTaxaOrder extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        order_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
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
        taxon_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          references: {
            model: 'taxa',
            key: 'taxon_id',
          },
        },
        position: {
          type: DataTypes.SMALLINT.UNSIGNED,
          allowNull: true,
        },
        // TODO(kenzley): Delete this column.
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        group_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'matrix_taxa_order',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'order_id' }],
          },
          {
            name: 'u_all',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'taxon_id' }, { name: 'matrix_id' }],
          },
          {
            name: 'u_rank',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'matrix_id' }, { name: 'position' }],
          },
        ],
      }
    )
  }
}
