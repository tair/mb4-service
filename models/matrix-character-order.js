import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class MatrixCharacterOrder extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    order_id: {
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
    position: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'matrix_character_order',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "order_id" },
        ]
      },
      {
        name: "u_all",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "character_id" },
          { name: "matrix_id" },
        ]
      },
      {
        name: "u_rank",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "matrix_id" },
          { name: "position" },
        ]
      },
    ]
  });
  }
}
