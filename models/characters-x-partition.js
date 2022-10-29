import _sequelize from 'sequelize';
const { Model } = _sequelize;

export default class CharactersXPartition extends Model {
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
    character_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      references: {
        model: 'characters',
        key: 'character_id'
      }
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'characters_x_partitions',
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
          { name: "character_id" },
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
        name: "fk_characters_x_partitions_character_id",
        using: "BTREE",
        fields: [
          { name: "character_id" },
        ]
      },
    ]
  });
  }
}
