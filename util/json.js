// TODO(kenzley): After the v4 launch, run a script to convert all JSON to
//     lowercase key entries so that we do not need this method.
/**
 * This normalizes a JSON object such that the keys are consistent. This is
 * useful because JSON objects within the MorphoBank database are not
 * consistent such that some have uppercase and lowercase.
 *
 * This method is used to convert the keys to lowercase so that they can be
 * accessed consistently in the javascript code since JSON keys are
 * case-sensitive.
 *
 * @param {Object} json The JSON object to normalize.
 */
export function normalizeJson(json) {
  if (json == null) {
    return null
  }

  return Object.fromEntries(
    Object.entries(json).map(([key, val]) => [key.toLowerCase(), val])
  )
}
