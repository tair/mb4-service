import _sequelize from 'sequelize';
const { Model } = _sequelize;

export default class TaxaXMedium extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    link_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      primaryKey: true
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
    media_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      references: {
        model: 'media_files',
        key: 'media_id'
      }
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    created_on: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'taxa_x_media',
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
        using: "BTREE",
        fields: [
          { name: "taxon_id" },
          { name: "media_id" },
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
        name: "fk_taxa_x_media_media_id",
        using: "BTREE",
        fields: [
          { name: "media_id" },
        ]
      },
    ]
  });
  }
}
