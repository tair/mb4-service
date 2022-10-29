import _sequelize from 'sequelize';
const { Model } = _sequelize;

export default class TaxaXPartition extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    link_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      primaryKey: true
    },
    partition_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      references: {
        model: 'partitions',
        key: 'partition_id'
      }
    },
    taxon_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      references: {
        model: 'taxa',
        key: 'taxon_id'
      }
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'taxa_x_partitions',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "link_id" },
        ]
      },
      {
        name: "u_all",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "partition_id" },
          { name: "taxon_id" },
        ]
      },
      {
        name: "i_user_id",
        using: "BTREE",
        fields: [
          { name: "user_id" },
        ]
      },
      {
        name: "fk_taxa_x_partitions_taxon_id",
        using: "BTREE",
        fields: [
          { name: "taxon_id" },
        ]
      },
    ]
  });
  }
}
