import crypto from 'crypto'

import { createReadStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'

export function getMagicNumber() {
  return Math.floor(Math.random() * 8_999) + 1_000
}

export function md5File(path) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5')
    const stream = createReadStream(path)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

export async function getDirectoryHash(basePath, id) {
  const subdirectories = parseInt(id / 100)
    .toString()
    .split('')
  let path = basePath
  for (const subdirectory of subdirectories) {
    path += '/' + subdirectory
    console.log('creating', path)
    await mkdir(path, { recursive: true })
  }

  return subdirectories.join('/')
}
