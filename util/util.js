const fs = require('fs')

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

async function readFile(fileName) {
  console.log('READING...')
  try {
    const data = fs.readFileSync(fileName, 'utf8')
    const obj = JSON.parse(data)
    return obj
  } catch (err) {
    console.error(err)
  }
}

async function writeToFile(fileName, content) {
  try {
    const data = fs.writeFileSync(fileName, content)
  } catch (err) {
    console.error(err)
  }
}

module.exports = {
  // buildImageProps,
  readFile,
  writeToFile,
}
