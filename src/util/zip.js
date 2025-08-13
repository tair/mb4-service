import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import decompress from 'decompress'
import mime from 'mime'

// Track temporary directories for cleanup
const tempDirectories = new Set()

export async function unzip(filePath) {
  let directory = null

  // Security limits
  const MAX_EXTRACTED_SIZE = 500 * 1024 * 1024 // 500MB total extraction limit
  const MAX_FILES = 1000 // Maximum number of files
  const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB per file

  try {
    // Verify the file exists and is readable
    await fs.access(filePath, fs.constants.R_OK)

    const tempPath = path.join(os.tmpdir(), 'mb-downloads')
    await fs.mkdir(tempPath, { recursive: true })

    directory = await fs.mkdtemp(path.join(tempPath, 'upload-'))
    tempDirectories.add(directory)

    let totalExtractedSize = 0
    let fileCount = 0

    const files = await decompress(filePath, directory, {
      filter: (file) => {
        // Security check: Prevent path traversal attacks
        const normalizedPath = path.normalize(file.path)
        if (normalizedPath.includes('..') || path.isAbsolute(normalizedPath)) {
          throw new Error(`Unsafe file path detected in ZIP archive: ${file.path}`)
        }

        // Security check: Prevent files with dangerous names
        const fileName = path.basename(file.path)
        if (fileName.startsWith('.') && !fileName.match(/^\.(jpg|jpeg|png|gif|tiff?|bmp|webp|dcm|dicom)$/i)) {
          return false // Skip hidden files except allowed image formats
        }

        // Security check: Limit number of files
        fileCount++
        if (fileCount > MAX_FILES) {
          throw new Error(`ZIP archive contains too many files (max: ${MAX_FILES})`)
        }

        // Security check: Limit individual file size
        const fileSize = file.data ? file.data.length : 0
        if (fileSize > MAX_FILE_SIZE) {
          throw new Error(`File ${file.path} is too large (max: ${MAX_FILE_SIZE / 1024 / 1024}MB)`)
        }

        // Security check: Limit total extracted size (ZIP bomb protection)
        totalExtractedSize += fileSize
        if (totalExtractedSize > MAX_EXTRACTED_SIZE) {
          throw new Error(`ZIP archive extracts to too much data (max: ${MAX_EXTRACTED_SIZE / 1024 / 1024}MB)`)
        }

        return true
      }
    })

    if (files.length === 0) {
      throw new Error('ZIP file is empty or contains no files')
    }

    const processedFiles = files.map((file) => {
      const filePath = path.join(directory, file.path)
      const mimetype = mime.getType(filePath) || 'application/octet-stream'

      return {
        originalname: file.path,
        path: filePath,
        mimetype: mimetype,
        size: file.data ? file.data.length : 0,
      }
    })

    return processedFiles
  } catch (error) {
    console.error('Error during ZIP extraction:', error)

    // Clean up on error
    if (directory) {
      await cleanupTempDirectory(directory)
    }

    if (error.code === 'ENOENT') {
      throw new Error('ZIP file not found or not accessible')
    } else if (error.message.includes('Invalid file signature')) {
      throw new Error('Invalid ZIP file format or corrupted archive')
    } else if (error.message.includes('ZIP file is empty')) {
      throw new Error('ZIP file is empty or contains no files')
    } else {
      throw new Error(`Failed to extract ZIP file: ${error.message}`)
    }
  }
}

export async function cleanupTempDirectory(directory) {
  try {
    if (tempDirectories.has(directory)) {
      await fs.rm(directory, { recursive: true, force: true })
      tempDirectories.delete(directory)
    }
  } catch (error) {
    console.error('Error cleaning up temporary directory:', error)
  }
}

export async function cleanupAllTempDirectories() {
  const cleanupPromises = Array.from(tempDirectories).map((dir) =>
    cleanupTempDirectory(dir)
  )
  await Promise.all(cleanupPromises)
}
