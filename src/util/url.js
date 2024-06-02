import axios from 'axios'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

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

  filename = filename ?? blob.name ?? url.split('/').pop()
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
export async function fetchWithRetry(options, params, maxRetries = 3) {
  let retries = 0
  let sendDelay = 1000
  return new Promise((resolve, reject) => {
    const fetch = async () => {
      try {
        const response = await axios.get(options, params)
        if (response.status >= 500 && ++retries < maxRetries) {
          setTimeout(() => fetch(), sendDelay)
          sendDelay = Math.min(20_000, sendDelay << 1)
        } else {
          resolve(response)
        }
      } catch (err) {
        console.error('Failed to fetch', err)
        reject(err)
      }
    }

    fetch()
  })
}
