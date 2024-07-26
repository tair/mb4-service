import { Buffer } from 'node:buffer'
import fs from 'fs/promises'
import { MEDIA_PATH } from '../util/media.js'

export class TilepicParser {
  
  constructor(path) {
    this.path = MEDIA_PATH + path
  }

  async getTilePic(tile) {
    const file = await fs.open(this.path, 'r')
    if (file == null) {
      throw `Couldn't open file: ${this.path}`
    }

    try {
      let buffer = Buffer.alloc(4)
      await file.read({buffer})

      // Verify that the file has the 'TPC' Magic header. This prevents fetching
      // files that are not in the TilePic format.
      const signature = buffer.toString('utf8')
      if (signature != 'TPC\n') {
        throw 'File is not Tilepic format'
      }

      // Read the Header Length and verify that it is valid.
      await file.read({buffer})
      const headerLength = buffer.readUInt32BE()
      if (headerLength <= 8) {
        throw 'Tilepic header length is invalid'
      }

      let position = headerLength + (tile - 1) * 4
      await file.read({buffer, position})
      const startPosition = buffer.readUInt32BE()

      position += 4
      await file.read({buffer, position})
      const endPosition = buffer.readUInt32BE()

      const fileLength = endPosition - startPosition
      buffer = Buffer.alloc(fileLength)
      await file.read({buffer, position: startPosition})

      return buffer
    } finally {
      await file.close()
    }
  }
}