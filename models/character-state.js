import _sequelize from 'sequelize'
const { Model } = _sequelize

export default class CharacterState extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        state_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        character_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          references: {
            model: 'characters',
            key: 'character_id',
          },
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        num: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        color: {
          type: DataTypes.STRING(6),
          allowNull: false,
          defaultValue: '',
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: '',
        },
        access: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                0, // Anyone may edit this character state
                1, // Only the owner may edit this character state
              ],
            ],
          },
        },
        ancestor_state_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          ancestored: true,
        },
      },
      {
        sequelize,
        tableName: 'character_states',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'state_id' }],
          },
          {
            name: 'i_character_id',
            using: 'BTREE',
            fields: [{ name: 'character_id' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'i_name',
            using: 'BTREE',
            fields: [{ name: 'name' }],
          },
        ],
      }
    )
  }
}
