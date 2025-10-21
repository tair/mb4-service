import sequelizeConn from './db.js'

// Cache object to store stats
let statsCache = {
  data: null,
  lastUpdated: null,
}

// Function to fetch fresh stats from database
const fetchFreshStats = async () => {
  // Return static numbers (temporary override)
  return {
    // Recent activity stats (last 30 days)
    numUniqueLogins: 167, // Scientists Working
    numAnonymousSessions: 22358, // Site Visitors
    numCells: 453373, // Cells Scored
    numMedia: 518, // Media Files Uploaded
    numProjectViews: 28523, // Project Views
    numProjectDownloads: 96, // Project Downloads
    numMatrixViews: 16686, // Matrix Views
    numMatrixDownloads: 138, // Matrix Downloads
    numMediaViews: 59563, // Media Views
    numMediaDownloads: 172, // Media Downloads

    // MorphoBank overall statistics (leave unchanged or zeroed while static mode is active)
    morphoBank: {
      publicProjectCount: 0,
      publicImageCount: 0,
      publicMatrixCount: 0,
      inProgressProjectCount: 0,
      inProgressImageCount: 0,
      inProgressMatrixCount: 0,
      userCount: 0,
      recentVisitorCount: 22358, // mirror site visitors if desired
      asOfDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    },
  }
}

// Function to get stats (either from cache or fresh)
export const getStats = async () => {
  const now = Date.now()
  const oneHour = 60 * 60 * 1000 // 1 hour in milliseconds

  // If cache is empty or older than 1 hour, fetch fresh data
  if (
    !statsCache.data ||
    !statsCache.lastUpdated ||
    now - statsCache.lastUpdated > oneHour
  ) {
    try {
      statsCache.data = await fetchFreshStats()
      statsCache.lastUpdated = now
    } catch (error) {
      // If there's an error fetching fresh data and we have cached data, return the cached data
      if (statsCache.data) {
        return statsCache.data
      }
      throw error
    }
  }

  return statsCache.data
}

// Initialize the cache on startup
export const initializeCache = async () => {
  try {
    statsCache.data = await fetchFreshStats()
    statsCache.lastUpdated = Date.now()
    console.log('Stats cache initialized')
  } catch (error) {
    console.error('Error initializing stats cache:', error)
  }
}
