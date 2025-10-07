import { Handler, HandlerErrors } from './handler.js'
import { models } from '../../models/init-models.js'
import fs from 'fs'
import path from 'path'
import { importMatrix, mergeMatrix } from '../matrix-import/matrix-importer.js'
import { promises as fsp } from 'fs'

export class MatrixImportHandler extends Handler {
  getName() {
    return 'MatrixImport'
  }

  async process(parameters) {
    try {
      const {
        projectId,
        userId,
        // For new matrix
        title,
        notes = '',
        itemNotes = '',
        otu = 'genus',
        published = 0,
        // For merge
        matrixId,
        // Data
        matrixJsonPath,
        // Uploaded file info
        filePath,
        originalname,
        mimetype = 'application/octet-stream',
        size = 0,
      } = parameters || {}

      if (!userId) {
        return this.createError(HandlerErrors.ILLEGAL_PARAMETER, 'Missing userId')
      }
      if (!projectId) {
        return this.createError(HandlerErrors.ILLEGAL_PARAMETER, 'Missing projectId')
      }
      if (!matrixJsonPath || !fs.existsSync(matrixJsonPath)) {
        return this.createError(HandlerErrors.ILLEGAL_PARAMETER, 'Missing matrix JSON file')
      }
      if (!filePath || !fs.existsSync(filePath)) {
        return this.createError(HandlerErrors.ILLEGAL_PARAMETER, 'Uploaded file not found')
      }

      // Load user model for auditing hooks
      const user = await models.User.findByPk(userId)
      if (!user) {
        return this.createError(HandlerErrors.ILLEGAL_PARAMETER, 'User not found')
      }

      // Reconstruct a file-like object expected by FileUploader
      const file = {
        path: filePath,
        originalname: originalname || path.basename(filePath),
        mimetype,
        size,
      }

      // Load matrix JSON from disk to avoid huge payload in task params
      let matrixObj
      try {
        const json = await fsp.readFile(matrixJsonPath, 'utf8')
        matrixObj = JSON.parse(json)
      } catch (e) {
        return this.createError(HandlerErrors.ILLEGAL_PARAMETER, 'Failed to read matrix JSON')
      }

      // Execute import or merge
      if (matrixId) {
        await mergeMatrix(
          matrixId,
          notes || '',
          itemNotes || '',
          user,
          matrixObj,
          file
        )
      } else {
        await importMatrix(
          title,
          notes || '',
          itemNotes || '',
          otu,
          published,
          user,
          projectId,
          matrixObj,
          file
        )
      }

      // Success result
      return {
        result: {
          message: 'Matrix import completed',
        },
      }
    } catch (e) {
      return this.createError(HandlerErrors.UNKNOWN_ERROR, e.message || 'Unknown error')
    }
  }
}


