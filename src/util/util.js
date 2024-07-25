import fs from 'fs'

// function buildImageProps(mediaObj, type) {
//   try {
//     media = mediaObj[type]

//     if (!media.HASH || !media.MAGIC || !media.FILENAME) return null

//     const url =
//       `https://morphobank.org/media/morphobank3/` +
//       `images/${media.HASH}/${media.MAGIC}_${media.FILENAME}`
//     return {
//       url: url,
//       width: media.WIDTH,
//       height: media.HEIGHT,
//     }
//   } catch (e) {
//     return null
//   }
// }

export async function readFile(fileName) {
  console.log('READING...')
  try {
    const data = fs.readFileSync(fileName, 'utf8')
    const obj = JSON.parse(data)
    return obj
  } catch (err) {
    console.error(err)
  }
}

export async function writeToFile(fileName, content) {
  try {
    fs.writeFileSync(fileName, content)
  } catch (err) {
    console.error(err)
  }
}

export async function createDir(dir) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  } catch (err) {
    console.error(`Error creating directory ${dir}. `, err.message)
  }
}

export function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

export function time() {
  return parseInt(Date.now() / 1000)
}

export function array_unique(array) {
  return Array.from(new Set(array))
}

export function array_difference(arr1, arr2) {
  return arr1.filter((x) => !arr2.includes(x))
}

export function array_intersect(arr1, arr2) {
  return arr1.filter((x) => arr2.includes(x))
}

export function array_symmetric_difference(arr1, arr2) {
  return arr1
    .filter((x) => !arr2.includes(x))
    .concat(arr2.filter((x) => !arr1.includes(x)))
}

export function set_intersect(set1, set2) {
  const results = new Set()
  for (const value of set2) {
    if (set1.has(value)) {
      results.add(value)
    }
  }
  return results
}

export function parseIntArray(array) {
  if (Array.isArray(array)) {
    const ints = array.filter((i) => i != null).map((i) => parseInt(i))
    return Array.from(new Set(ints))
  }
  return []
}

export function parseNullableInt(value) {
  return value == null ? null : parseInt(value)
}

export function parseNullableFloat(value) {
  return value == null ? null : parseFloat(value)
}

export function getFormattedDateTime() {
  return new Date().toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour12: true,
  }) + ' PST'
}