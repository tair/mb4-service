import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class CellsXMedium extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    link_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      primaryKey: true
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
    taxon_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      references: {
        model: 'taxa',
        key: 'taxon_id'
      }
    },
    character_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      references: {
        model: 'characters',
        key: 'character_id'
      }
    },
    matrix_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      references: {
        model: 'matrices',
        key: 'matrix_id'
      }
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    created_on: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    ancestor_link_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    set_by_automation: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    },
    source: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: ""
    }
  }, {
    sequelize,
    tableName: 'cells_x_media',
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
          { name: "media_id" },
          { name: "character_id" },
          { name: "taxon_id" },
          { name: "matrix_id" },
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
        name: "fk_cells_x_media_matrix_id",
        using: "BTREE",
        fields: [
          { name: "matrix_id" },
        ]
      },
      {
        name: "fk_cells_x_media_taxon_id",
        using: "BTREE",
        fields: [
          { name: "taxon_id" },
        ]
      },
      {
        name: "fk_cells_x_media_character_id",
        using: "BTREE",
        fields: [
          { name: "character_id" },
        ]
      },
    ]
  });
  }
}