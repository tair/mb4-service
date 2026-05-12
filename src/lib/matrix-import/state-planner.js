// MB4-448: Plan create/update actions for a character's incoming states.
//
// The AI character extractor emits states positionally — when a paper labels
// states by parenthetical index (e.g. "Trifid (3) or bifid (2)"), the prompt
// pads lower slots with empty strings so each named state lands at its
// declared index: ["", "", "bifid", "Trifid"]. New state rows must therefore
// be created with `num` equal to the state's index in the input array, not
// `maxNum + 1` — otherwise empty padding gets dropped or de-duplicated by
// the name lookup and every named state shifts one slot left, mis-mapping
// every cell score that referenced the higher digits after upload.
//
// Empty / whitespace-only names are skipped entirely;
// padCharacterStatesToMatchScores fills any slot referenced by cell scores
// with a "State N" placeholder.
//
// Within-call dedup: the prior inline loop mutated stateNameMap after each
// create so a repeat of the same non-empty name later in the same array hit
// the "already exists" branch. The plan is computed up front now, so track
// names planned-for-create here and skip subsequent occurrences — preserving
// the prior behavior that one duplicate-name input never produces two rows.
//
// num collision handling: for AI-extracted new characters the project row's
// states[] is empty, so every array index is free and `num = i` matches the
// state's declared position (the MB4-448 fix). For re-import / merge paths
// where the project character already has states at certain `num`s, falling
// back to (maxUsedNum + 1) when index `i` collides preserves the prior
// behavior and avoids duplicate `num` rows under one character (the DB
// has no unique constraint on (character_id, num)).
export function planStateActions(
  stateObjs,
  existingStatesByName,
  existingNums = []
) {
  const actions = []
  const plannedNames = new Set()
  const usedNums = new Set(existingNums)
  for (let i = 0; i < stateObjs.length; i++) {
    const stateObj = stateObjs[i]
    const stateName = stateObj?.name
    if (
      stateName != null &&
      (existingStatesByName.has(stateName) || plannedNames.has(stateName))
    ) {
      if (stateObj.notes && existingStatesByName.has(stateName)) {
        actions.push({
          kind: 'update',
          state: existingStatesByName.get(stateName),
          notes: stateObj.notes,
        })
      }
      continue
    }
    if (stateName == null || String(stateName).trim() === '') {
      continue
    }
    let num = i
    if (usedNums.has(num)) {
      num = (usedNums.size ? Math.max(...usedNums) : -1) + 1
    }
    actions.push({ kind: 'create', num, name: stateName })
    plannedNames.add(stateName)
    usedNums.add(num)
  }
  return actions
}
