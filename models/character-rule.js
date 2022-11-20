import _sequelize from 'sequelize'
const { Model } = _sequelize

export default class CharacterRule extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        rule_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        character_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'characters',
            key: 'character_id',
          },
        },
        state_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: 'character_states',
            key: 'state_id',
          },
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        created_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
        },
        source: {
          type: DataTypes.STRING(40),
          allowNull: false,
          defaultValue: '',
        },
      },
      {
        sequelize,
        tableName: 'character_rules',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'rule_id' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'fk_character_rules_state_id',
            using: 'BTREE',
            fields: [{ name: 'state_id' }],
          },
          {
            name: 'fk_character_rules_character_id',
            using: 'BTREE',
            fields: [{ name: 'character_id' }],
          },
        ],
      }
    )
  }
}
