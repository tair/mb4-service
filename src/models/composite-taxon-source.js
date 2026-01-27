import _sequelize from 'sequelize'
const { Model } = _sequelize

export default class CompositeTaxonSource extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        composite_taxon_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'composite_taxa',
            key: 'composite_taxon_id',
          },
        },
        source_taxon_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'taxa',
            key: 'taxon_id',
          },
          comment: 'Source taxon that contributes to the composite',
        },
        position: {
          type: DataTypes.SMALLINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          comment: 'Ordering of source taxa',
        },
      },
      {
        sequelize,
        tableName: 'composite_taxa_sources',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'id' }],
          },
          {
            name: 'u_composite_source',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'composite_taxon_id' }, { name: 'source_taxon_id' }],
          },
          {
            name: 'i_source_taxon_id',
            using: 'BTREE',
            fields: [{ name: 'source_taxon_id' }],
          },
          {
            name: 'i_composite_position',
            using: 'BTREE',
            fields: [{ name: 'composite_taxon_id' }, { name: 'position' }],
          },
        ],
      }
    )
  }
}

