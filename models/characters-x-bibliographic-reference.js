import _sequelize from 'sequelize'
const { Model, Sequelize } = _sequelize

export default class CharactersXBibliographicReference extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        link_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        reference_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'bibliographic_references',
            key: 'reference_id',
          },
        },
        character_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'characters',
            key: 'character_id',
          },
        },
        pp: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        source: {
          type: DataTypes.STRING(40),
          allowNull: false,
          defaultValue: '',
        },
      },
      {
        sequelize,
        tableName: 'characters_x_bibliographic_references',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'link_id' }],
          },
          {
            name: 'u_all2',
            unique: true,
            using: 'BTREE',
            fields: [
              { name: 'reference_id' },
              { name: 'character_id' },
              { name: 'pp' },
            ],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'fk_characters_x_bibliographic_references_character_id',
            using: 'BTREE',
            fields: [{ name: 'character_id' }],
          },
        ],
      }
    )
  }
}
