import fs from 'fs/promises'
import { createWriteStream } from 'fs'
import os from 'os'
import path from 'path'
import decompress from 'decompress'
import mime from 'mime'
import yauzl from 'yauzl'

// Track temporary directories for cleanup
const tempDirectories = new Set()

// Supported image extensions for CT scan thumbnail extraction
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'tif', 'tiff', 'gif', 'bmp', 'webp', 'dcm', 'dicom']

/**
 * Extract the first image file from a ZIP archive using lazy/streaming extraction.
 * Stops immediately after finding and extracting the first valid image file.
 * This is memory-efficient for large ZIP files (like CT scans) where we only need
 * one image for thumbnail generation.
 * 
 * @param {string} zipPath - Path to the ZIP file
 * @returns {Promise<{path: string, originalname: string, mimetype: string, size: number} | null>}
 *          Returns the extracted file info, or null if no image found
 */
export async function extractFirstImageFromZip(zipPath) {
  // Verify the file exists
  await fs.access(zipPath, fs.constants.R_OK)

  // Create temp directory for extraction
  const tempPath = path.join(os.tmpdir(), 'mb-downloads')
  await fs.mkdir(tempPath, { recursive: true })
  const directory = await fs.mkdtemp(path.join(tempPath, 'first-image-'))
  tempDirectories.add(directory)

  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (err, zipfile) => {
      if (err) {
        reject(new Error(`Failed to open ZIP file: ${err.message}`))
        return
      }

      let foundImage = false

      zipfile.on('error', (err) => {
        reject(new Error(`ZIP read error: ${err.message}`))
      })

      zipfile.on('entry', (entry) => {
        // Skip if we already found an image (shouldn't happen with lazyEntries but be safe)
        if (foundImage) {
          zipfile.close()
          return
        }

        const fileName = entry.fileName
        
        // Skip directories
        if (fileName.endsWith('/')) {
          zipfile.readEntry()
          return
        }

        // Skip macOS metadata and system files
        if (
          fileName.startsWith('__MACOSX/') ||
          fileName.startsWith('._') ||
          fileName.includes('/.DS_Store') ||
          fileName === '.DS_Store' ||
          fileName.includes('/Thumbs.db') ||
          fileName === 'Thumbs.db'
        ) {
          zipfile.readEntry()
          return
        }

        // Security check: Prevent path traversal attacks
        const normalizedPath = path.normalize(fileName)
        if (normalizedPath.includes('..') || path.isAbsolute(normalizedPath)) {
          zipfile.readEntry()
          return
        }

        // Check if this is an image file
        const extension = fileName.split('.').pop()?.toLowerCase() || ''
        if (!IMAGE_EXTENSIONS.includes(extension)) {
          zipfile.readEntry()
          return
        }

        // Found an image! Extract it
        foundImage = true
        const outputPath = path.join(directory, path.basename(fileName))
        const mimetype = mime.getType(fileName) || 'application/octet-stream'

        zipfile.openReadStream(entry, (err, readStream) => {
          if (err) {
            reject(new Error(`Failed to read ZIP entry: ${err.message}`))
            return
          }

          const writeStream = createWriteStream(outputPath)
          let fileSize = 0

          readStream.on('data', (chunk) => {
            fileSize += chunk.length
            // Security: Limit individual file size to 100MB
            if (fileSize > 100 * 1024 * 1024) {
              readStream.destroy(new Error('File too large (max 100MB)'))
              writeStream.destroy()
            }
          })

          readStream.on('error', (err) => {
            writeStream.destroy()
            reject(new Error(`Failed to extract image: ${err.message}`))
          })

          writeStream.on('error', (err) => {
            reject(new Error(`Failed to write extracted image: ${err.message}`))
          })

          writeStream.on('finish', () => {
            // Close the ZIP file since we found what we need
            zipfile.close()
            
            resolve({
              path: outputPath,
              originalname: fileName,
              mimetype: mimetype,
              size: fileSize,
              tempDirectory: directory,
            })
          })

          readStream.pipe(writeStream)
        })
      })

      zipfile.on('end', () => {
        // If we reach the end without finding an image
        if (!foundImage) {
          resolve(null)
        }
      })

      zipfile.on('close', () => {
        // Cleanup will happen via cleanupTempDirectory
      })

      // Start reading entries
      zipfile.readEntry()
    })
  })
}

/**
 * Extract the first image from a ZIP file stored in S3.
 * Downloads only enough of the ZIP to find and extract the first image.
 * 
 * @param {Buffer} zipBuffer - The ZIP file buffer (could be partial for optimization later)
 * @returns {Promise<{buffer: Buffer, originalname: string, mimetype: string} | null>}
 */
export async function extractFirstImageFromBuffer(zipBuffer) {
  // Create a temporary file to use with yauzl (yauzl works better with files)
  const tempPath = path.join(os.tmpdir(), 'mb-downloads')
  await fs.mkdir(tempPath, { recursive: true })
  const tempZipPath = path.join(tempPath, `temp-${Date.now()}.zip`)
  
  try {
    await fs.writeFile(tempZipPath, zipBuffer)
    const result = await extractFirstImageFromZip(tempZipPath)
    
    if (result) {
      // Read the extracted image into a buffer
      const imageBuffer = await fs.readFile(result.path)
      
      // Cleanup the extracted image file
      await cleanupTempDirectory(result.tempDirectory)
      
      return {
        buffer: imageBuffer,
        originalname: result.originalname,
        mimetype: result.mimetype,
        size: imageBuffer.length,
      }
    }
    
    return null
  } finally {
    // Cleanup temp ZIP file
    try {
      await fs.unlink(tempZipPath)
    } catch {
      // Ignore cleanup errors
    }
  }
}

export async function unzip(filePath) {
  let directory = null

  // Security limits
  const MAX_EXTRACTED_SIZE = 500 * 1024 * 1024 // 500MB total extraction limit
  const MAX_FILES = 5000 // Maximum number of files
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

        // Skip directories and symlinks explicitly to avoid EISDIR errors
        if (file.type === 'directory' || file.type === 'symlink' || file.path.endsWith('/')) {
          return false
        }

        // Skip common OS metadata and junk files
        if (
          normalizedPath.startsWith('__MACOSX/') ||
          normalizedPath.endsWith('/.DS_Store') ||
          normalizedPath === '.DS_Store' ||
          normalizedPath.startsWith('._') ||
          normalizedPath.endsWith('/Thumbs.db') ||
          normalizedPath === 'Thumbs.db'
        ) {
          return false
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
