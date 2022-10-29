import _sequelize from 'sequelize';
const { Model } = _sequelize;

export default class FoliosXMediaFile extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    link_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      primaryKey: true
    },
    folio_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      references: {
        model: 'folios',
        key: 'folio_id'
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
    notes: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    position: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'folios_x_media_files',
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
          { name: "folio_id" },
          { name: "media_id" },
        ]
      },
      {
        name: "fk_folios_x_media_files_media_id",
        using: "BTREE",
        fields: [
          { name: "media_id" },
        ]
      },
    ]
  });
  }
}
