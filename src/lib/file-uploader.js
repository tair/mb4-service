import { copyFile } from 'node:fs/promises'

import { Datamodel } from './datamodel/datamodel.js'
import config from '../config.js'
import { getDirectoryHash, getMagicNumber, md5File } from '../util/file.js'

export class FileUploader {
  constructor(transaction, user) {
    this.transaction = transaction
    this.user = user
  }

  async setFile(model, fieldName, file) {
    const tableName = model.constructor.tableName
    const fieldAttributes = model.rawAttributes[fieldName]
    const volume = fieldAttributes.volume || tableName

    const datamodel = Datamodel.getInstance()
    const primaryKeys = datamodel.getPrimaryKey(model)
    if (primaryKeys.length != 1) {
      throw 'Model does not have a single primary key'
    }

    const rowId = model[primaryKeys[0]]
    if (!rowId) {
      throw 'Row Id is not defined'
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

    // TODO(kenzley): The JSON's keys are uppercase because MorphoBank v3 has
    //     stored the keys this way. Once Morphobank is solely on v4, let's
    //     convert the keys to lowercase since that's better JSON.
    const json = {
      VOLUME: volume,
      MIMETYPE: file.mimetype,
      FILENAME: newFileName,
      HASH: hash,
      MAGIC: magic,
      MD5: await md5File(file.path),
      FILESIZE: file.size,
      ORIGINAL_FILENAME: file.originalname,
      PROPERTIES: {
        mimetype: file.mimetype,
        filesize: file.size,
      },
    }
    model.set(fieldName, json)
  }
}
