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
export function planStateActions(stateObjs, existingStatesByName) {
  const actions = []
  for (let i = 0; i < stateObjs.length; i++) {
    const stateObj = stateObjs[i]
    const stateName = stateObj?.name
    if (stateName != null && existingStatesByName.has(stateName)) {
      if (stateObj.notes) {
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
    actions.push({ kind: 'create', num: i, name: stateName })
  }
  return actions
}
