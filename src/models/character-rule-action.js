import _sequelize from 'sequelize'
const { Model } = _sequelize

export default class CharacterRuleAction extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        action_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        rule_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'character_rules',
            key: 'rule_id',
          },
        },
        // TODO: We should convert this to an small int rather than a string.
        action: {
          type: DataTypes.STRING(20),
          allowNull: false,
          validate: {
            isIn: [['SET_STATE', 'ADD_MEDIA']],
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
      },
      {
        sequelize,
        tableName: 'character_rule_actions',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'action_id' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'fk_character_rule_actions_rule_id',
            using: 'BTREE',
            fields: [{ name: 'rule_id' }],
          },
          {
            name: 'fk_character_rule_actions_character_id',
            using: 'BTREE',
            fields: [{ name: 'character_id' }],
          },
          {
            name: 'fk_character_rule_actions_state_id',
            using: 'BTREE',
            fields: [{ name: 'state_id' }],
          },
        ],
      }
    )
  }
}
