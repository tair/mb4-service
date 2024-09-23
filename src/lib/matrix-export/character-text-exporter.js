import { Exporter } from './exporter.js'

export class CharacterTextExporter extends Exporter {
  constructor(writeFunction) {
    super(writeFunction)
  }

  export({ characters, includeNotes }) {
    this.writeLine(`[ ${this.getOutputMessage()} ]`)
    this.writeLine('Phenotypic characters (numbered in Nexus format)')

    let characterIndex = 0
    for (const character of characters) {
      const characterName = this.cleanName(character.name)
      this.write(` ${++characterIndex}. ${characterName} `)

      if (includeNotes && character.description) {
        this.write(`[[ ${this.cleanText(character.description)}]]`)
      }

      if (character.states) {
        const stateTexts = []

        let stateIndex = 0
        for (const state of character.states) {
          const stateName = this.cleanName(state.name)
          stateTexts.push(`${stateName} (${stateIndex++})`)
        }

        this.write(' : ' + stateTexts.join(';  '))
      }

      this.writeLine('.')
    }
  }
}
