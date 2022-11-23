import fs from 'fs/promises'
import { Handler } from './handler.js'

/** A handler to deletion files from the file system. */
export class FileDeletionHandler extends Handler {
  async process(parameters) {
    for (const filePath of parameters.file_paths) {
      try {
        await fs.unlink(filePath)
      } catch (e) {
        // If the file doesn't exists, let's continue since it may have been
        // deleted from a previous run.
        if (e.code == 'ENOENT') {
          continue
        }
        throw e
      }
    }
    return {
      result: {
        files: parameters.file_paths.length,
      },
    }
  }

  getName() {
    return 'FileDeletion'
  }
}
