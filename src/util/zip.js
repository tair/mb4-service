import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import decompress from 'decompress'
import mime from 'mime'

export async function unzip(filePath) {
  const tempPath = path.join(os.tmpdir(), 'mb-downloads')
  await fs.mkdir(tempPath, { recursive: true })

  const directory = await fs.mkdtemp(path.join(tempPath, 'upload-'))

  const files = await decompress(filePath, directory)
  return files.map((file) => {
    const path = directory + '/' + file.path
    return {
      originalname: file.path,
      path,
      mimetype: mime.getType(path),
    }
  })
}
