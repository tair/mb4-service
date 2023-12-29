import { Exporter } from './exporter.js'

export class CharacterRulesTextExporter extends Exporter {
  constructor(writeFunction) {
    super(writeFunction)
  }

  export({ rules }) {
    this.writeLine(HEADERS.join('\t'))
    let currentRuleId
    for (const rule of rules) {
      const characterRuleId = rule.rule_id
      if (currentRuleId != characterRuleId) {
        currentRuleId = characterRuleId
        const stateName = rule.state_name
          ? `[${rule.state_num}] ${rule.state_name}`
          : '-'
        this.write(
          `${rule.character_num}\t${rule.character_name}\t${stateName}\t`
        )
      } else {
        this.write(' \t \t \t')
      }

      const actionStateName = rule.action_state_name
        ? `[${rule.action_state_num}] ${rule.action_state_name}`
        : '-'
      this.writeLine(
        `${rule.action}\t${rule.action_position}\t${rule.action_character_name}\t${actionStateName}`
      )
    }
  }
}

const HEADERS = [
  'Character number',
  'Character name',
  'State name/number',
  'Action',
  'Target character number',
  'Target character',
  'Target state',
]
