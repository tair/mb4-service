import { describe, expect, test } from '@jest/globals'

import { planStateActions } from 'lib/matrix-import/state-planner'

describe('planStateActions (MB4-448)', () => {
  test('contiguous-from-zero names get num=index', () => {
    const actions = planStateActions(
      [{ name: 'Absent' }, { name: 'Present' }],
      new Map()
    )
    expect(actions).toEqual([
      { kind: 'create', num: 0, name: 'Absent' },
      { kind: 'create', num: 1, name: 'Present' },
    ])
  })

  test('AI parenthetical-index padding preserves declared positions', () => {
    // Prompt emits "Trifid (3) or bifid (2)" as ["", "", "bifid", "Trifid"].
    // Pre-fix behavior assigned num=0 to "bifid" and num=1 to "Trifid",
    // shifting them two slots left so cells scored 2/3 displayed the wrong
    // state after upload.
    const actions = planStateActions(
      [{ name: '' }, { name: '' }, { name: 'bifid' }, { name: 'Trifid' }],
      new Map()
    )
    expect(actions).toEqual([
      { kind: 'create', num: 2, name: 'bifid' },
      { kind: 'create', num: 3, name: 'Trifid' },
    ])
  })

  test('whitespace-only and null/undefined names are treated as empty padding', () => {
    const actions = planStateActions(
      [
        { name: '   ' },
        { name: null },
        { name: undefined },
        {},
        { name: 'real' },
      ],
      new Map()
    )
    expect(actions).toEqual([{ kind: 'create', num: 4, name: 'real' }])
  })

  test('existing-by-name match yields no action when no notes provided', () => {
    const existing = new Map([['Absent', { state_id: 99, num: 0 }]])
    const actions = planStateActions(
      [{ name: 'Absent' }, { name: 'Present' }],
      existing
    )
    expect(actions).toEqual([
      { kind: 'create', num: 1, name: 'Present' },
    ])
  })

  test('existing-by-name match with notes yields update action carrying the existing row', () => {
    const existing = new Map([['Absent', { state_id: 99, num: 0 }]])
    const actions = planStateActions(
      [{ name: 'Absent', notes: 'updated desc' }],
      existing
    )
    expect(actions).toEqual([
      {
        kind: 'update',
        state: { state_id: 99, num: 0 },
        notes: 'updated desc',
      },
    ])
  })

  test('empty input yields no actions', () => {
    expect(planStateActions([], new Map())).toEqual([])
  })

  test('duplicate non-empty names within one input produce only one create (matches prior inline-loop behavior)', () => {
    // The prior inline loop mutated stateNameMap after each create, so a
    // repeat of the same non-empty name later in the same input was treated
    // as already-existing and skipped (no-op when no notes). Preserved here
    // via the within-call plannedNames set.
    const actions = planStateActions(
      [{ name: 'foo' }, { name: 'foo' }, { name: 'bar' }],
      new Map()
    )
    expect(actions).toEqual([
      { kind: 'create', num: 0, name: 'foo' },
      { kind: 'create', num: 2, name: 'bar' },
    ])
  })

  test('all-empty padding (cells will reference these slots, pad pass fills them) yields no creates', () => {
    // Edge case: a character whose states the AI couldn't name at all.
    // Returning no creates here is correct — padCharacterStatesToMatchScores
    // will insert "State N" placeholders for whichever digits cell scores
    // actually use.
    expect(
      planStateActions([{ name: '' }, { name: '' }, { name: '' }], new Map())
    ).toEqual([])
  })
})
