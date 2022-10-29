import _sequelize from 'sequelize';
const { Model } = _sequelize;

export default class CellNote extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    note_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      primaryKey: true
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
    character_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      references: {
        model: 'characters',
        key: 'character_id'
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
    created_on: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    last_modified_on: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    status: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false
    },
    ancestor_note_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    source: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: ""
    }
  }, {
    sequelize,
    tableName: 'cell_notes',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "note_id" },
        ]
      },
      {
        name: "u_all",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "matrix_id" },
          { name: "character_id" },
          { name: "taxon_id" },
        ]
      },
      {
        name: "fk_cell_notes_taxon_id",
        using: "BTREE",
        fields: [
          { name: "taxon_id" },
        ]
      },
      {
        name: "fk_cell_notes_character_id",
        using: "BTREE",
        fields: [
          { name: "character_id" },
        ]
      },
    ]
  });
  }
}
