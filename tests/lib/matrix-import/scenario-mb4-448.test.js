/**
 * MB4-448 end-to-end scenario test.
 *
 * Models the full backend state pipeline:
 *   planStateActions   → create rows with num=arrayIndex (this fix)
 *   pad placeholders   → fill any digit a cell uses with "State N"
 *   processCellValue   → cell digit D resolves to state where state.num === D
 *
 * Replays it against Tanya's Turrilitoidea_Monks_1999.nex + the saved AI
 * extractor response, and against the empty-string-padded shape the
 * 2026-05-11 prompt now emits for parenthetical-index characters.
 *
 * Pure JS — no DB, no S3, no live curator call.
 */
import fs from 'fs'
import { describe, expect, test } from '@jest/globals'

import { planStateActions } from 'lib/matrix-import/state-planner'

const FIXTURE_DIR = 'tests/lib/matrix-import'

// ---------- helpers that mirror real backend code ----------

// Mirrors padCharacterStatesToMatchScores logic in matrix-importer.js:
// for each character, find the highest digit any cell uses, and ensure
// states[] has a row at every num from 0..maxDigit (filling gaps with
// generic "State N" placeholders).
function applyPadPlaceholders(states, cellDigits) {
  const existingNums = new Set(states.map((s) => s.num))
  let maxDigit = -1
  for (const d of cellDigits) if (d > maxDigit) maxDigit = d
  const out = [...states]
  for (let n = 0; n <= maxDigit; n++) {
    if (!existingNums.has(n)) out.push({ num: n, name: `State ${n}` })
  }
  out.sort((a, b) => a.num - b.num)
  return out
}

// Mirrors processCellValue's lookup: cell digit D → state with state.num === D.
function resolveCell(digit, states) {
  return states.find((s) => s.num === digit) || null
}

// Walks plan → models.CharacterState.create the way the importer would.
function runImporter(aiStates) {
  const actions = planStateActions(aiStates, new Map())
  const created = []
  for (const a of actions) {
    if (a.kind === 'create') created.push({ num: a.num, name: a.name })
  }
  return created
}

// Parses just enough of a NEXUS MATRIX block to get per-column digits.
function parseNex(nexPath) {
  const text = fs.readFileSync(nexPath, 'utf8')
  const ncharMatch = text.match(/NCHAR\s*=\s*(\d+)/i)
  const nchar = parseInt(ncharMatch[1])
  const matrixMatch = text.match(/\bMATRIX\b([\s\S]*?);/i)
  let body = matrixMatch[1].replace(/\[[^\]]*\]/g, '') // strip [...] comments
  const rows = []
  for (let line of body.split('\n')) {
    line = line.trim()
    if (!line) continue
    const m = line.match(/^(?:'([^']+)'|(\S+))\s+(.*)$/)
    if (!m) continue
    const taxon = m[1] || m[2]
    const rest = m[3]
    const cells = []
    let i = 0
    while (i < rest.length && cells.length < nchar) {
      const ch = rest[i]
      if (/\s/.test(ch)) { i++; continue }
      if (ch === '(' || ch === '[' || ch === '{') {
        const close = { '(': ')', '[': ']', '{': '}' }[ch]
        const j = rest.indexOf(close, i + 1)
        if (j === -1) break
        cells.push(rest.slice(i + 1, j))
        i = j + 1
      } else {
        cells.push(ch); i++
      }
    }
    if (cells.length) rows.push({ taxon, cells })
  }
  // Per-column digit set (numeric only; ignore ?, -, letter codes).
  const colDigits = Array.from({ length: nchar }, () => new Set())
  for (const { cells } of rows) {
    for (let col = 0; col < Math.min(cells.length, nchar); col++) {
      for (const ch of cells[col]) {
        if (ch >= '0' && ch <= '9') colDigits[col].add(parseInt(ch))
      }
    }
  }
  return { nchar, rows, colDigits }
}

// ---------- direct Tanya-scenario test (the bug surface) ----------

describe('MB4-448 end-to-end: parenthetical-padded states survive upload', () => {
  test('Tanya scenario: "Trifid (3) or bifid (2)" preserves named states at correct positions', () => {
    // The 2026-05-11 curator prompt now emits this character as:
    const aiStates = [
      { name: '' },
      { name: '' },
      { name: 'bifid' },
      { name: 'Trifid' },
    ]
    // Matrix cells for this character use digits {0, 2, 3} across taxa.
    const cellDigits = [0, 2, 3]

    const created = runImporter(aiStates)
    expect(created).toEqual([
      { num: 2, name: 'bifid' },
      { num: 3, name: 'Trifid' },
    ])

    const final = applyPadPlaceholders(created, cellDigits)
    // After pad: 0 and 1 get placeholder names, 2 and 3 keep their AI names.
    expect(final).toEqual([
      { num: 0, name: 'State 0' },
      { num: 1, name: 'State 1' },
      { num: 2, name: 'bifid' },
      { num: 3, name: 'Trifid' },
    ])

    // The actual proof: every cell digit resolves to the state name the
    // paper declared (NOT a one-slot-left shift, NOT a placeholder).
    expect(resolveCell(0, final).name).toBe('State 0') // unnamed; cell value valid but no PDF name
    expect(resolveCell(2, final).name).toBe('bifid')    // ← was "Trifid" before fix
    expect(resolveCell(3, final).name).toBe('Trifid')   // ← was "State 3" placeholder before fix
  })

  test('Pre-fix simulation: the old maxNum+1 path mis-mapped this scenario', () => {
    // Reproduce the old buggy behavior to confirm we're fixing what we think we're fixing.
    const aiStates = [
      { name: '' },
      { name: '' },
      { name: 'bifid' },
      { name: 'Trifid' },
    ]
    const projectStates = []
    const stateNameMap = new Map()
    for (const s of aiStates) {
      if (stateNameMap.has(s.name)) continue
      const existingNums = projectStates.map((x) => x.num || 0)
      const maxNum = existingNums.length ? Math.max(...existingNums) : -1
      const newRow = { num: maxNum + 1, name: s.name }
      projectStates.push(newRow)
      stateNameMap.set(s.name, newRow)
    }
    // Old code creates the empty-name state at num=0 then de-dupes subsequent ""s.
    expect(projectStates).toEqual([
      { num: 0, name: '' },
      { num: 1, name: 'bifid' },
      { num: 2, name: 'Trifid' },
    ])
    const cellDigits = [0, 2, 3]
    const final = applyPadPlaceholders(projectStates, cellDigits)
    // Old combined result: cell digit 2 lands on "Trifid" (wrong), 3 on "State 3" (wrong).
    expect(resolveCell(2, final).name).toBe('Trifid')
    expect(resolveCell(3, final).name).toBe('State 3')
  })

  // ---------- replay against the actual Monks 1999 fixture ----------

  test('Monks 1999: replaying the cached AI response gives no shifted/dropped named states', () => {
    const nex = parseNex(`${FIXTURE_DIR}/Turrilitoidea_Monks_1999.nex`)
    const cached = JSON.parse(
      fs.readFileSync(
        `${FIXTURE_DIR}/curator_response_Turrilitoidea_Monks_1999.json`,
        'utf8'
      )
    )
    const aiCharacters = cached.character_states || cached.characters || []
    expect(aiCharacters.length).toBe(nex.nchar)

    // Replay every character through the new pipeline and confirm: each named
    // state from the AI ends up at the same index it was declared at, AND every
    // cell digit resolves to *some* state (no silent drops).
    for (let col = 0; col < nex.nchar; col++) {
      const aiStates = aiCharacters[col].states.map((name) => ({ name }))
      const declaredAtIndex = aiCharacters[col].states.map(
        (name, i) => ({ i, name })
      )
      const created = runImporter(aiStates)
      // Every non-empty declared state ends up at num=its-array-index.
      for (const { i, name } of declaredAtIndex) {
        if (name == null || String(name).trim() === '') continue
        const row = created.find((r) => r.num === i)
        expect(row).toBeDefined()
        expect(row.name).toBe(name)
      }
      const final = applyPadPlaceholders(created, [...nex.colDigits[col]])
      for (const d of nex.colDigits[col]) {
        const r = resolveCell(d, final)
        expect(r).not.toBeNull() // every digit must have a target row
      }
    }
  })

  test('Monks 1999 + simulated new-prompt padding: cells map to declared names, not placeholders', () => {
    // Hand-patch the cached (old-prompt) response into the empty-string-padded
    // shape the 2026-05-11 prompt would emit for characters whose matrix uses
    // digits above the AI's positional count. For Monks 1999, that's any
    // column whose max cell digit > len(aiStates) - 1.
    const nex = parseNex(`${FIXTURE_DIR}/Turrilitoidea_Monks_1999.nex`)
    const cached = JSON.parse(
      fs.readFileSync(
        `${FIXTURE_DIR}/curator_response_Turrilitoidea_Monks_1999.json`,
        'utf8'
      )
    )
    const aiCharacters = cached.character_states || cached.characters || []

    let columnsRequiringPad = 0
    let cellsResolved = 0
    let cellsToNamed = 0
    let cellsToPlaceholder = 0

    for (let col = 0; col < nex.nchar; col++) {
      const digits = [...nex.colDigits[col]].sort((a, b) => a - b)
      if (!digits.length) continue
      const maxDigit = digits[digits.length - 1]
      const original = aiCharacters[col].states
      let aiStates
      if (maxDigit >= original.length) {
        // Simulate the new prompt right-aligning the named states to
        // their parenthetical indices, padding lower slots with "".
        columnsRequiringPad++
        const offset = maxDigit - original.length + 1
        aiStates = Array.from({ length: maxDigit + 1 }, (_, i) =>
          i < offset ? { name: '' } : { name: original[i - offset] }
        )
      } else {
        aiStates = original.map((name) => ({ name }))
      }

      const created = runImporter(aiStates)
      const final = applyPadPlaceholders(created, digits)

      for (const d of digits) {
        const r = resolveCell(d, final)
        expect(r).not.toBeNull()
        cellsResolved++
        if (r.name.startsWith('State ')) cellsToPlaceholder++
        else cellsToNamed++
      }
    }

    // Diagnostic — useful when the test fails to see proportions at a glance.
    // eslint-disable-next-line no-console
    console.log(
      `Monks 1999 new-prompt sim: pad-required cols=${columnsRequiringPad}, ` +
        `cells resolved=${cellsResolved}, → named=${cellsToNamed}, → "State N" placeholder=${cellsToPlaceholder}`
    )

    // The sim should produce at least some pad-required columns (otherwise
    // we're not actually exercising the fix path).
    expect(columnsRequiringPad).toBeGreaterThan(0)
    // Most cells should land on a named state once the prompt + the fix
    // are both in play. (Some columns the AI couldn't name still fall to
    // "State N", which is correct behavior.)
    expect(cellsToNamed).toBeGreaterThan(cellsToPlaceholder)
  })
})
