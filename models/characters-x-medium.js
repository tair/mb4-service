import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class CharactersXMedium extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    link_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      primaryKey: true
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
    state_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'character_states',
        key: 'state_id'
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
    source: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: ""
    }
  }, {
    sequelize,
    tableName: 'characters_x_media',
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
          { name: "character_id" },
          { name: "media_id" },
          { name: "state_id" },
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
        name: "fk_characters_x_media_state_id",
        using: "BTREE",
        fields: [
          { name: "state_id" },
        ]
      },
      {
        name: "fk_characters_x_media_media_id",
        using: "BTREE",
        fields: [
          { name: "media_id" },
        ]
      },
    ]
  });
  }
}
