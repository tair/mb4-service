import { randomUUID } from 'crypto'

// In-memory cache for TNT content
// Key: cacheKey (UUID), Value: { content: string, matrixId: number, createdAt: number }
const tntCache = new Map()

// Cache expiration time (30 minutes)
const CACHE_EXPIRATION = 30 * 60 * 1000 // 30 minutes in milliseconds

// Cleanup interval (every 10 minutes)
const CLEANUP_INTERVAL = 10 * 60 * 1000 // 10 minutes in milliseconds

// Store interval reference for cleanup
let cleanupInterval = null

/**
 * Store TNT content in cache and return a cache key
 * @param {string} tntContent - The TNT content to cache
 * @param {number} matrixId - The matrix ID associated with this content
 * @returns {string} - Cache key (UUID)
 */
export const cacheTntContent = (tntContent, matrixId) => {
  const cacheKey = randomUUID()
  const now = Date.now()

  tntCache.set(cacheKey, {
    content: tntContent,
    matrixId: matrixId,
    createdAt: now,
  })

  console.log(`TNT content cached for matrix ${matrixId} with key: ${cacheKey}`)
  return cacheKey
}

/**
 * Retrieve TNT content from cache
 * @param {string} cacheKey - The cache key to retrieve
 * @returns {object|null} - Cache entry or null if not found/expired
 */
export const getTntContent = (cacheKey) => {
  const entry = tntCache.get(cacheKey)

  if (!entry) {
    return null
  }

  const now = Date.now()

  // Check if entry has expired
  if (now - entry.createdAt > CACHE_EXPIRATION) {
    tntCache.delete(cacheKey)
    console.log(`Expired TNT cache entry removed: ${cacheKey}`)
    return null
  }

  return entry
}

/**
 * Remove a specific cache entry
 * @param {string} cacheKey - The cache key to remove
 * @returns {boolean} - True if entry was removed, false if not found
 */
export const removeTntContent = (cacheKey) => {
  const removed = tntCache.delete(cacheKey)
  if (removed) {
    console.log(`TNT cache entry removed: ${cacheKey}`)
  }
  return removed
}

/**
 * Clean up expired cache entries
 */
const cleanupExpiredEntries = () => {
  const now = Date.now()
  let removedCount = 0

  for (const [key, entry] of tntCache.entries()) {
    if (now - entry.createdAt > CACHE_EXPIRATION) {
      tntCache.delete(key)
      removedCount++
    }
  }

  if (removedCount > 0) {
    console.log(`TNT cache cleanup: removed ${removedCount} expired entries`)
  }
}

/**
 * Get cache statistics
 * @returns {object} - Cache statistics
 */
export const getCacheStats = () => {
  return {
    totalEntries: tntCache.size,
    cacheKeys: Array.from(tntCache.keys()),
  }
}

/**
 * Initialize the TNT cache cleanup interval
 */
export const initializeTntCache = () => {
  // Start cleanup interval
  cleanupInterval = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL)
  console.log('TNT cache initialized with cleanup interval')
}

/**
 * Cleanup function for graceful shutdown
 */
export const shutdownTntCache = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
  }
  tntCache.clear()
  console.log('TNT cache shutdown complete')
}

// Register cleanup handlers for various shutdown signals
process.on('SIGTERM', shutdownTntCache)
process.on('SIGINT', shutdownTntCache)
process.on('exit', shutdownTntCache)
