import { promises as fs } from 'fs'
import path from 'path'
import sharp from 'sharp'
import { execSync } from 'child_process'

/**
 * Video processing utility for generating thumbnails and extracting metadata
 * Uses FFmpeg for video processing when available
 */
export class VideoProcessor {
  constructor() {
    this.ffmpegAvailable = this.checkFFmpegAvailability()
  }

  checkFFmpegAvailability() {
    try {
      execSync('ffmpeg -version', { stdio: 'ignore' })
      return true
    } catch (error) {
      console.warn('FFmpeg not available, video thumbnail generation will be skipped')
      return false
    }
  }

  /**
   * Extract video metadata (duration, dimensions, etc.)
   * @param {string} videoPath - Path to the video file
   * @returns {Promise<Object>} Video metadata
   */
  async extractMetadata(videoPath) {
    if (!this.ffmpegAvailable) {
      return Promise.resolve({
        duration: 60, // Default 1 minute
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 1000000,
        size: 10000000, // 10MB
        fps: 30,
      })
    }

    try {
      const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`
      const result = execSync(command, { encoding: 'utf-8' })
      const metadata = JSON.parse(result)
      
      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video')
      if (!videoStream) {
        throw new Error('No video stream found in file')
      }

      return {
        duration: parseFloat(metadata.format.duration) || 60,
        width: videoStream.width || 1920,
        height: videoStream.height || 1080,
        codec: videoStream.codec_name || 'unknown',
        bitrate: parseInt(metadata.format.bit_rate) || 1000000,
        size: parseInt(metadata.format.size) || 10000000,
        fps: this.parseFrameRate(videoStream.r_frame_rate) || 30,
      }
    } catch (error) {
      console.warn('Failed to extract video metadata:', error.message)
      // Return default metadata on error
      return {
        duration: 60,
        width: 1920,
        height: 1080,
        codec: 'unknown',
        bitrate: 1000000,
        size: 10000000,
        fps: 30,
      }
    }
  }

  /**
   * Parse video frame rate string safely
   * @param {string} frameRateString - Frame rate in format like "30/1" or "25/1"
   * @returns {number} Frame rate as number
   */
  parseFrameRate(frameRateString) {
    if (!frameRateString || typeof frameRateString !== 'string') {
      return 30; // default
    }
    
    // Handle common formats: "30/1", "25/1", "23976/1000"
    const match = frameRateString.match(/^(\d+)\/(\d+)$/);
    if (match) {
      const numerator = parseInt(match[1], 10);
      const denominator = parseInt(match[2], 10);
      return denominator > 0 ? numerator / denominator : 30;
    }
    
    // Handle direct numbers: "30", "25.0"
    const directMatch = frameRateString.match(/^[\d.]+$/);
    if (directMatch) {
      return parseFloat(frameRateString) || 30;
    }
    
    return 30; // fallback
  }

  /**
   * Generate thumbnails from video at 1/8 duration point
   * @param {string} videoPath - Path to the video file
   * @param {string} outputDir - Directory to save thumbnails
   * @param {Object} metadata - Video metadata
   * @returns {Promise<Object>} Generated thumbnail info
   */
  async generateThumbnails(videoPath, outputDir, metadata) {
    if (!this.ffmpegAvailable) {
      console.log('FFmpeg not available, skipping video thumbnail generation')
      return Promise.resolve({
        large: { path: null, width: 720, height: 405 },
        thumbnail: { path: null, width: 120, height: 120 },
      })
    }

    try {
      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true })

      // Calculate timestamp for thumbnail extraction (1/8 of duration)
      const thumbnailTime = Math.max(1, Math.floor(metadata.duration / 8))

      // Generate base thumbnail from video
      const baseThumbnailPath = path.join(outputDir, 'base_thumbnail.jpg')
      await this.extractFrame(videoPath, baseThumbnailPath, thumbnailTime)

      // Read the base thumbnail to generate different sizes
      const baseImage = sharp(baseThumbnailPath)
      const baseMetadata = await baseImage.metadata()

      // Generate different sizes
      const thumbnails = {
        large: {
          path: path.join(outputDir, 'large.jpg'),
          width: Math.min(720, baseMetadata.width),
          height: Math.min(720, baseMetadata.height),
        },
        thumbnail: {
          path: path.join(outputDir, 'thumbnail.jpg'),
          width: 120,
          height: 120,
        },
      }

      // Generate large thumbnail (maintain aspect ratio, max 720px)
      await baseImage
        .resize(thumbnails.large.width, thumbnails.large.height, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .jpeg({ quality: 85 })
        .toFile(thumbnails.large.path)

      // Generate small thumbnail (120x120, cropped to center)
      await baseImage
        .resize(thumbnails.thumbnail.width, thumbnails.thumbnail.height, { 
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80 })
        .toFile(thumbnails.thumbnail.path)

      // Clean up base thumbnail
      await fs.unlink(baseThumbnailPath)

      return {
        large: {
          path: thumbnails.large.path,
          width: thumbnails.large.width,
          height: thumbnails.large.height,
        },
        thumbnail: {
          path: thumbnails.thumbnail.path,
          width: thumbnails.thumbnail.width,
          height: thumbnails.thumbnail.height,
        },
      }
    } catch (error) {
      console.warn('Failed to generate video thumbnails:', error.message)
      return Promise.resolve({
        large: { path: null, width: 720, height: 405 },
        thumbnail: { path: null, width: 120, height: 120 },
      })
    }
  }

  /**
   * Extract a single frame from video at specified time
   * @param {string} videoPath - Path to the video file
   * @param {string} outputPath - Path for the extracted frame
   * @param {number} time - Time in seconds to extract frame
   * @param {number} maxSize - Maximum size for the longest dimension
   * @returns {Promise<void>}
   */
  async extractFrame(videoPath, outputPath, time, maxSize = 720) {
    if (!this.ffmpegAvailable) {
      throw new Error('FFmpeg not available for frame extraction')
    }

    return new Promise((resolve, reject) => {
      // Create output directory if it doesn't exist
      const outputDir = path.dirname(outputPath)
      execSync(`mkdir -p "${outputDir}"`, { stdio: 'ignore' })

      // FFmpeg command to extract a frame
      const command = `ffmpeg -i "${videoPath}" -ss ${time} -vframes 1 -q:v 2 -vf "scale='min(${maxSize},iw)':'min(${maxSize},ih)':force_original_aspect_ratio=decrease" "${outputPath}" -y`
      
      try {
        execSync(command, { stdio: 'ignore' })
        resolve()
      } catch (error) {
        reject(new Error(`Frame extraction failed: ${error.message}`))
      }
    })
  }

  /**
   * Get video format information for browser compatibility
   * @param {string} filename - Original filename
   * @returns {Object} Format information
   */
  getVideoFormat(filename) {
    const extension = path.extname(filename).toLowerCase()
    
    // Map extensions to MIME types
    const mimeTypeMap = {
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.webm': 'video/webm',
      '.mkv': 'video/x-matroska',
      '.wmv': 'video/x-ms-wmv',
      '.flv': 'video/x-flv',
      '.m4v': 'video/x-m4v',
    }

    return {
      extension: extension.substring(1), // Remove the dot
      mimeType: mimeTypeMap[extension] || 'video/mp4',
      browserCompatible: ['.mp4', '.webm', '.mov'].includes(extension),
    }
  }

  /**
   * Clean up temporary files and directories
   * @param {Array<string>} paths - Array of file and directory paths to delete
   */
  async cleanup(paths) {
    for (const targetPath of paths) {
      try {
        const stat = await fs.stat(targetPath)
        if (stat.isDirectory()) {
          // Remove directory recursively
          await fs.rm(targetPath, { recursive: true, force: true })
          console.log(`Cleaned up directory: ${targetPath}`)
        } else {
          // Remove file
          await fs.unlink(targetPath)
          console.log(`Cleaned up file: ${targetPath}`)
        }
      } catch (error) {
        // If file/directory doesn't exist, that's fine
        if (error.code === 'ENOENT') {
          console.log(`Path already cleaned up: ${targetPath}`)
        } else {
          console.warn(`Failed to clean up ${targetPath}:`, error.message)
        }
      }
    }
  }
}

export default VideoProcessor