import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import decompress from 'decompress'
import mime from 'mime'

// Track temporary directories for cleanup
const tempDirectories = new Set()

export async function unzip(filePath) {
  console.log('Starting ZIP extraction from:', filePath)
  
  let directory = null
  
  try {
    // Verify the file exists and is readable
    await fs.access(filePath, fs.constants.R_OK)
    
    const tempPath = path.join(os.tmpdir(), 'mb-downloads')
    await fs.mkdir(tempPath, { recursive: true })

    directory = await fs.mkdtemp(path.join(tempPath, 'upload-'))
    tempDirectories.add(directory)
    console.log('Created temporary directory:', directory)

    const files = await decompress(filePath, directory)
    console.log(`Extracted ${files.length} files from ZIP`)
    
    if (files.length === 0) {
      throw new Error('ZIP file is empty or contains no files')
    }

    const processedFiles = files.map((file) => {
      const filePath = path.join(directory, file.path)
      const mimetype = mime.getType(filePath) || 'application/octet-stream'
      
      console.log(`Processing extracted file: ${file.path} (${mimetype})`)
      
      return {
        originalname: file.path,
        path: filePath,
        mimetype: mimetype,
        size: file.data ? file.data.length : 0
      }
    })

    console.log(`Successfully processed ${processedFiles.length} files from ZIP`)
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
      console.log('Cleaned up temporary directory:', directory)
    }
  } catch (error) {
    console.error('Error cleaning up temporary directory:', error)
  }
}

export async function cleanupAllTempDirectories() {
  const cleanupPromises = Array.from(tempDirectories).map(dir => cleanupTempDirectory(dir))
  await Promise.all(cleanupPromises)
}
