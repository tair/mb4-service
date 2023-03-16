import crypto from 'crypto'

import { createReadStream } from 'node:fs'
import { copyFile, mkdir } from 'node:fs/promises'
import config from '../config.js'

export class FileUploader {
  constructor(transaction, user) {
    this.transaction = transaction
    this.user = user
  }

  async setFile(model, fieldName, file) {
    const tableName = model.constructor.tableName
    const fieldAttributes = model.rawAttributes[fieldName]
    const volume = fieldAttributes.volume || tableName

    const primaryKeys = getPrimaryKey(model)
    if (primaryKeys.length != 1) {
      throw 'Model does not have a single primary key cannot have logged'
    }

    const rowId = model[primaryKeys[0]]
    if (!rowId) {
      throw 'Row Id is not defined and cannot be logged.'
    }

    let fileExtension = file.originalname.split('.').pop()
    if (!fileExtension) {
      fileExtension = 'bin'
    } else if (
      fileExtension ||
      !file.mimetype ||
      file.mimetype == 'application/octet-stream'
    ) {
      fileExtension += '.bin'
    }

    const magic = getMagicNumber()
    const newFileName = `${tableName}_${fieldName}.${fileExtension}`
    const basePath = `${config.media.directory}/${config.app.name}/${volume}`
    const hash = await getDirectoryHash(basePath, rowId)
    await copyFile(file.path, `${basePath}/${hash}/${magic}_${newFileName}`)
    const json = {
      volume: volume,
      mimetype: file.mimetype,
      filename: newFileName,
      hash: hash,
      magic: magic,
      md5: md5File(file.path),
      fileSize: file.size,
    }
    model.set(fieldName, json)
  }
}

function getPrimaryKey(model) {
  const primaryKeys = []
  for (const [field, attributes] of Object.entries(model.rawAttributes)) {
    if (attributes.primaryKey) {
      primaryKeys.push(field)
    }
  }
  return primaryKeys
}

function getMagicNumber() {
  return Math.floor(Math.random() * 10_000)
}

function md5File(path) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5')
    const stream = createReadStream(path)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function getDirectoryHash(basePath, id) {
  const subdirectories = parseInt(id / 100)
    .toString()
    .split('')
  let path = basePath
  for (const subdirectory of subdirectories) {
    path += '/' + subdirectory
    await mkdir(path, { recursive: true })
  }

  return subdirectories.join('/')
}
