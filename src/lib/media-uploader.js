import { unlink } from 'node:fs/promises'
import sharp from 'sharp'
import { Datamodel } from './datamodel/datamodel.js'
import config from '../config.js'
import { getDirectoryHash, getMagicNumber, md5File } from '../util/file.js'

export class MediaUploader {
  constructor(transaction, user) {
    this.transaction = transaction
    this.user = user
    this.newlyCreatedFiles = []
  }

  async setMedia(model, fieldName, file) {
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

    const extension = file.originalname.split('.').pop()
    const basePath = `${config.media.directory}/${config.app.name}/${volume}`
    const hash = await getDirectoryHash(basePath, rowId)

    const media = sharp(file.path)

    // TODO(kenzley): The JSON's keys are uppercase because MorphoBank v3 has
    //     stored the keys this way. Once Morphobank is solely on v4, let's
    //     convert the keys to lowercase since that's better JSON. And update
    //     the JSON so that we don't duplicate values.
    const json = {
      ORIGINAL_FILENAME: file.originalname,
    }

    for (const ruleName in rules) {
      const magic = getMagicNumber()
      const fileName = `${tableName}_${fieldName}_${rowId}_${ruleName}.${extension}`
      const path = `${basePath}/${hash}/${magic}_${fileName}`

      const rule = rules[ruleName]
      const resizedMedia = rule.scale
        ? media.resize(rule.scale.width, rule.scale.heigth)
        : media
      const info = await resizedMedia.toFile(path)
      this.newlyCreatedFiles.push(path)

      json[ruleName] = {
        VOLUME: volume,
        MIMETYPE: file.mimetype,
        FILENAME: fileName,
        HASH: hash,
        MAGIC: magic,
        MD5: await md5File(path),
        EXTENSION: extension,
        WIDTH: info.width,
        HEIGHT: info.height,
        PROPERTIES: {
          height: info.height,
          width: info.width,
          mimetype: file.mimetype,
          filesize: info.size,
          version: ruleName,
        },
      }
    }
    model.set(fieldName, json)
  }

  commit() {
    this.newlyCreatedFiles = []
  }

  async rollback() {
    for (const file of this.newlyCreatedFiles) {
      await unlink(file)
    }
  }
}

const rules = {
  icon: {
    scale: {
      height: 72,
      width: 72,
    },
  },
  preview: {
    scale: {
      height: 140,
      width: 100,
    },
  },
  thumbnail: {
    scale: {
      height: 120,
      width: 120,
    },
  },
  small: {
    scale: {
      height: 240,
      width: 240,
    },
  },
  medium: {
    scale: {
      height: 400,
      width: 400,
    },
  },
  large: {
    scale: {
      height: 800,
      width: 800,
    },
  },
  original: {},
}
