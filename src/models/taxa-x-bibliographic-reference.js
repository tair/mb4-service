import _sequelize from 'sequelize'
const { Model } = _sequelize

export default class TaxaXBibliographicReference extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        link_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        reference_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'bibliographic_references',
            key: 'reference_id',
          },
        },
        taxon_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'taxa',
            key: 'taxon_id',
          },
        },
        // TODO(kenzley): Update to support null values
        pp: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        // TODO(kenzley): Update to support null values
        notes: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: '',
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'taxa_x_bibliographic_references',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'link_id' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'fk_taxa_x_bibliographic_references_reference_id',
            using: 'BTREE',
            fields: [{ name: 'reference_id' }],
          },
          {
            name: 'fk_taxa_x_bibliographic_references_taxon_id',
            using: 'BTREE',
            fields: [{ name: 'taxon_id' }],
          },
        ],
      }
    )
  }
}
