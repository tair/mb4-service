import sequelizeConn from './db.js'

// Cache object to store stats
let statsCache = {
  data: null,
  lastUpdated: null,
}

// Function to fetch fresh stats from database
const fetchFreshStats = async () => {
  // Static numbers (temporary override) for homepage top metrics
  const staticTop = {
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
  }

  // Run DB queries only for fields that were previously zero placeholders
  const publicProjectsQuery = `
    SELECT COUNT(*) as count
    FROM projects p
    WHERE p.published = 1 AND p.deleted = 0`

  const publicImagesQuery = `
    SELECT COUNT(*) as count
    FROM media_files mf
    INNER JOIN projects p ON mf.project_id = p.project_id
    WHERE p.published = 1 AND p.deleted = 0`

  const publicMatricesQuery = `
    SELECT COUNT(*) as count
    FROM matrices m
    INNER JOIN projects p ON m.project_id = p.project_id
    WHERE p.published = 1 AND p.deleted = 0 AND m.deleted = 0`

  const inProgressProjectsQuery = `
    SELECT COUNT(*) as count
    FROM projects p
    WHERE p.published = 0 AND p.deleted = 0`

  const inProgressImagesQuery = `
    SELECT COUNT(*) as count
    FROM media_files mf
    INNER JOIN projects p ON mf.project_id = p.project_id
    WHERE p.published = 0 AND p.deleted = 0`

  const inProgressMatricesQuery = `
    SELECT COUNT(*) as count
    FROM matrices m
    INNER JOIN projects p ON m.project_id = p.project_id
    WHERE p.published = 0 AND p.deleted = 0 AND m.deleted = 0`

  const userCountQuery = `
    SELECT COUNT(*) as count
    FROM ca_users u
    WHERE u.active = 1`

  try {
    const [
      publicProjectsResult,
      publicImagesResult,
      publicMatricesResult,
      inProgressProjectsResult,
      inProgressImagesResult,
      inProgressMatricesResult,
      userCountResult,
    ] = await Promise.all([
      sequelizeConn.query(publicProjectsQuery, { type: sequelizeConn.QueryTypes.SELECT }),
      sequelizeConn.query(publicImagesQuery, { type: sequelizeConn.QueryTypes.SELECT }),
      sequelizeConn.query(publicMatricesQuery, { type: sequelizeConn.QueryTypes.SELECT }),
      sequelizeConn.query(inProgressProjectsQuery, { type: sequelizeConn.QueryTypes.SELECT }),
      sequelizeConn.query(inProgressImagesQuery, { type: sequelizeConn.QueryTypes.SELECT }),
      sequelizeConn.query(inProgressMatricesQuery, { type: sequelizeConn.QueryTypes.SELECT }),
      sequelizeConn.query(userCountQuery, { type: sequelizeConn.QueryTypes.SELECT }),
    ])

    return {
      ...staticTop,
      morphoBank: {
        publicProjectCount: parseInt(publicProjectsResult[0]?.count || 0),
        publicImageCount: parseInt(publicImagesResult[0]?.count || 0),
        publicMatrixCount: parseInt(publicMatricesResult[0]?.count || 0),
        inProgressProjectCount: parseInt(inProgressProjectsResult[0]?.count || 0),
        inProgressImageCount: parseInt(inProgressImagesResult[0]?.count || 0),
        inProgressMatrixCount: parseInt(inProgressMatricesResult[0]?.count || 0),
        userCount: parseInt(userCountResult[0]?.count || 0),
        recentVisitorCount: staticTop.numAnonymousSessions,
        asOfDate: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      },
    }
  } catch (error) {
    // If these queries fail, still return static top numbers and zeroed morphoBank counts
    console.error('Error fetching Morphobank overall stats:', error)
    return {
      ...staticTop,
      morphoBank: {
        publicProjectCount: 0,
        publicImageCount: 0,
        publicMatrixCount: 0,
        inProgressProjectCount: 0,
        inProgressImageCount: 0,
        inProgressMatrixCount: 0,
        userCount: 0,
        recentVisitorCount: staticTop.numAnonymousSessions,
        asOfDate: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      },
    }
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
