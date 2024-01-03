import _sequelize from 'sequelize'
const { Model } = _sequelize

// TODO(kenzley): We do not need this table. We can include the taxon_id
//     directly into the specimens table since there should be a one-to-one
//     mapping between specimen and their taxon. There are a few instances of
//     one-to-many taxa but we can de-duplicate them and remove them.
export default class TaxaXSpecimen extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        link_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
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
        specimen_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          references: {
            model: 'specimens',
            key: 'specimen_id',
          },
        },
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
        tableName: 'taxa_x_specimens',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'link_id' }],
          },
          {
            name: 'u_all',
            using: 'BTREE',
            fields: [{ name: 'taxon_id' }, { name: 'specimen_id' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'fk_taxa_x_specimens_specimen_id',
            using: 'BTREE',
            fields: [{ name: 'specimen_id' }],
          },
        ],
      }
    )
  }
}
