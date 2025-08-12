import axios from 'axios'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { Buffer } from 'node:buffer'

/**
 * Download the URL to the local machine in the temporary directory.
 *
 * @param {string} url The URL to download
 * @param {string} filename The name of the file that will be saved locally.
 * @returns
 */
export async function downloadUrl(url, filename = null) {
  const response = await fetch(url)
  if (response.status != 200) {
    throw `Failed to get URL: ${url}`
  }

  const contentType = response.headers.get('Content-Type')
  const blob = await response.blob()

  const tempPath = path.join(os.tmpdir(), 'mb-downloads')
  await fs.mkdir(tempPath, { recursive: true })

  const directory = await fs.mkdtemp(path.join(tempPath, 'url-'))

  filename = filename ?? blob.name ?? getFileNameFromUrl(url, contentType)
  const tempFilePath = path.join(directory, filename)

  const arrayBuffer = await blob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  await fs.writeFile(tempFilePath, buffer)

  // Return an object to match the one used by Express
  return {
    originalname: filename,
    path: tempFilePath,
    mimetype: contentType,
  }
}

/**
 * The external service is very brittle and it will return a 502 at times. We will retry
 * three times with an exponential delay to ensure that we get a response.
 */
export async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let retries = 0
  let sendDelay = 1000
  
  // Configure axios with proper timeout and headers
  const axiosConfig = {
    timeout: 20000, // 20 second timeout - reasonable for external APIs
    headers: {
      'User-Agent': 'MorphoBank/4.0 (Scientific Research Application)',
      ...options.headers
    },
    ...options
  }
  
  return new Promise((resolve, reject) => {
    const fetch = async () => {
      try {
        const response = await axios.get(url, axiosConfig)
        if (response.status >= 500 && ++retries < maxRetries) {
          console.log(`Request failed with status ${response.status}, retrying in ${sendDelay}ms (attempt ${retries}/${maxRetries})`)
          setTimeout(() => fetch(), sendDelay)
          sendDelay = Math.min(20_000, sendDelay << 1)
        } else {
          resolve(response)
        }
      } catch (err) {
        // Handle timeout and network errors with retries
        const isRetriableError = 
          err.code === 'ECONNABORTED' || // axios timeout
          err.code === 'ENOTFOUND' ||   // DNS errors
          err.code === 'ECONNRESET' ||  // connection reset
          err.code === 'ETIMEDOUT' ||   // general timeout
          (err.response && err.response.status >= 500) || // server errors
          err.message.includes('timeout') ||
          err.message.includes('Network Error')
          
        if (isRetriableError && ++retries < maxRetries) {
          console.log(`Request failed with error: ${err.message}, retrying in ${sendDelay}ms (attempt ${retries}/${maxRetries})`)
          setTimeout(() => fetch(), sendDelay)
          sendDelay = Math.min(20_000, sendDelay << 1)
        } else {
          console.error('Failed to fetch after all retries:', err.message)
          reject(err)
        }
      }
    }

    fetch()
  })
}

export function getFileNameFromUrl(string, contentType = '') {
  const url = new URL(string)
  const filename = url.pathname.split('/').pop()
  if (filename.length == 0) {
    return ''
  }

  const fileParts = filename.split('.')
  if (fileParts.length > 1) {
    return filename
  }
  const extension = getExtension(contentType)
  return filename + '.' + extension
}

function getExtension(contentType) {
  switch (contentType) {
    case 'image/gif':
      return 'gif'
    case 'image/jpg':
      return 'jpg'
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'text/html':
      return 'html'
    default:
      return 'bin'
  }
}
