import _sequelize from 'sequelize';
const { Model } = _sequelize;

export default class Cell extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    cell_id: {
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
    character_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      references: {
        model: 'characters',
        key: 'character_id'
      }
    },
    state_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'character_states',
        key: 'state_id'
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
      allowNull: false,
      defaultValue: 0
    },
    access: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    },
    last_modified_on: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    },
    created_on: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    },
    is_npa: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0
    },
    is_uncertain: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 0
    },
    ancestor_cell_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    start_value: {
      type: DataTypes.DECIMAL(20,10),
      allowNull: true
    },
    end_value: {
      type: DataTypes.DECIMAL(20,10),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'cells',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "cell_id" },
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
        name: "i_created_on",
        using: "BTREE",
        fields: [
          { name: "created_on" },
        ]
      },
      {
        name: "fk_cells_taxon_id",
        using: "BTREE",
        fields: [
          { name: "taxon_id" },
        ]
      },
      {
        name: "fk_cells_character_id",
        using: "BTREE",
        fields: [
          { name: "character_id" },
        ]
      },
      {
        name: "fk_cells_state_id",
        using: "BTREE",
        fields: [
          { name: "state_id" },
        ]
      },
      {
        name: "fk_cells_matrix_id",
        using: "BTREE",
        fields: [
          { name: "matrix_id" },
        ]
      },
    ]
  });
  }
}
