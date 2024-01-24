import { unlink } from 'node:fs/promises'

export class MediaUploader {
  constructor(transaction, user) {
    this.transaction = transaction
    this.user = user
    this.newlyCreatedFiles = []
  }

  async setMedia(model, fieldName, file) {
    console.log('Skipping writing the media', file)
    model.set(fieldName, null)
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
