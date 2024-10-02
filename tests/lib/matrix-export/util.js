import { Table } from 'lib/table'

export const matrix = {
  type: 0,
}

export const taxa = [
  {
    taxon_id: 1,
    genus: 'Homo sapien',
  },
  {
    taxon_id: 2,
    genus: 'Homo erectus',
    notes: 'Test comment',
  },
]

export const characters = [
  {
    character_id: 1,
    type: 0,
    name: 'Bipedal',
    description: 'Whether you can walk',
    ordering: 1,
    states: [
      {
        state_id: 1,
        name: 'yes',
        num: 0,
      },
      {
        state_id: 2,
        name: 'no',
        num: 1,
      },
    ],
  },
  {
    character_id: 2,
    type: 0,
    name: 'Toes',
    description: 'How many toes?',
    ordering: 2,
    states: [
      {
        state_id: 3,
        name: '10 or more',
        num: 0,
      },
      {
        state_id: 4,
        name: 'under 10',
        num: 1,
      },
    ],
  },
  {
    character_id: 3,
    type: 0,
    name: 'Fingers',
    description: 'How many fingers',
    ordering: 1,
    states: [
      {
        state_id: 5,
        name: '9 or less',
        num: 0,
      },
      {
        state_id: 6,
        name: '10',
        num: 1,
      },
      {
        state_id: 7,
        name: '11 or more',
        num: 2,
      },
    ],
  },
]

export const cells = [
  {
    taxon_id: 1,
    character_id: 1,
    state_id: 1,
  },
  {
    taxon_id: 1,
    character_id: 2,
    state_id: 1,
  },
  {
    taxon_id: 1,
    character_id: 2,
    state_id: 2,
  },
  {
    taxon_id: 1,
    character_id: 3,
    state_id: 5,
    is_uncertain: true,
  },
  {
    taxon_id: 1,
    character_id: 3,
    state_id: 6,
    is_uncertain: true,
  },
  {
    taxon_id: 1,
    character_id: 3,
    state_id: 7,
    is_uncertain: true,
  },
  {
    taxon_id: 1,
    character_id: 2,
    state_id: null,
  },
]

export const notes = [
  {
    taxon_id: 1,
    character_id: 1,
    notes: 'Walker!',
  },
  {
    taxon_id: 1,
    character_id: 2,
    notes: 'Lots of toes',
  },
]

export function createCellTable(cells) {
  const table = new Table()
  for (const cell of cells) {
    const taxonId = cell.taxon_id
    const characterId = cell.character_id
    if (!table.has(taxonId, characterId)) {
      table.set(taxonId, characterId, [])
    }
    table.get(taxonId, characterId).push(cell)
  }
  return table
}
