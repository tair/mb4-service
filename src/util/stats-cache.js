import sequelizeConn from './db.js'

// Cache object to store stats
let statsCache = {
  data: null,
  lastUpdated: null,
}

// Function to fetch fresh stats from database
const fetchFreshStats = async () => {
  try {
    // Get unique logins in last 30 days
    const uniqueLoginsQuery = `
      SELECT COUNT(DISTINCT user_id) as count 
      FROM stats_login_log 
      WHERE datetime_started >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)
      AND datetime_started <= UNIX_TIMESTAMP(NOW())
    `

    // Get anonymous sessions in last 30 days
    const anonymousSessionsQuery = `
      WITH login_sessions AS (
        SELECT DISTINCT session_key
        FROM stats_login_log
        WHERE (datetime_started >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY) AND datetime_started <= UNIX_TIMESTAMP(NOW()))
        OR (datetime_ended >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY) AND datetime_ended <= UNIX_TIMESTAMP(NOW()))
        OR (datetime_started <= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY) AND datetime_ended >= UNIX_TIMESTAMP(NOW()))
      )
      SELECT COUNT(DISTINCT sl.session_key) as count 
      FROM stats_session_log sl
      WHERE ((sl.datetime_started >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY) AND sl.datetime_started <= UNIX_TIMESTAMP(NOW()))
         OR (sl.datetime_ended >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY) AND sl.datetime_ended <= UNIX_TIMESTAMP(NOW()))
         OR (sl.datetime_started <= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY) AND sl.datetime_ended >= UNIX_TIMESTAMP(NOW())))
         AND sl.session_key NOT IN (SELECT session_key FROM login_sessions)
    `

    // Get total cells scored in last 30 days
    // const cellsQuery = `
    //   SELECT count(*) as count
    //   FROM cells c
    //   INNER JOIN matrices m ON c.matrix_id = m.matrix_id
    //   INNER JOIN projects p ON m.project_id = p.project_id
    //   WHERE m.deleted = 0 AND p.deleted = 0
    //   AND c.created_on >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)
    // `

    const cellsQuery = `
      SELECT count(*) as count from cells 
      where created_on >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)
    `

    // Get total media uploaded in last 30 days
    const mediaQuery = `
      SELECT COUNT(*) as count 
      FROM media_files m
      INNER JOIN projects p ON m.project_id = p.project_id
      WHERE p.deleted = 0
      AND m.created_on >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)
    `

    // Get project views/downloads in last 30 days
    const projectViewsQuery = `
      SELECT COUNT(*) as views
      FROM stats_pub_hit_log
      WHERE hit_type = 'P'
      AND hit_datetime >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)
    `

    const projectDownloadsQuery = `
      SELECT COUNT(*) as downloads
      FROM stats_pub_download_log
      WHERE download_type = 'P'
      AND download_datetime >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)
    `

    // Get matrix views/downloads in last 30 days
    const matrixViewsQuery = `
      SELECT COUNT(*) as views
      FROM stats_pub_hit_log
      WHERE hit_type = 'X'
      AND hit_datetime >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)
    `

    const matrixDownloadsQuery = `
      SELECT COUNT(*) as downloads
      FROM stats_pub_download_log
      WHERE download_type = 'X'
      AND download_datetime >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)
    `

    // Get media views/downloads in last 30 days
    const mediaViewsQuery = `
      SELECT COUNT(*) as views
      FROM stats_pub_hit_log
      WHERE hit_type = 'M'
      AND hit_datetime >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)
    `

    const mediaDownloadsQuery = `
      SELECT COUNT(*) as downloads
      FROM stats_pub_download_log
      WHERE download_type = 'M'
      AND download_datetime >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)
    `

    // MorphoBank Overall Statistics Queries
    const publicProjectsQuery = `
      SELECT COUNT(*) as count
      FROM projects p
      WHERE p.published = 1 AND p.deleted = 0
    `

    const publicImagesQuery = `
      SELECT COUNT(*) as count
      FROM media_files mf
      INNER JOIN projects p ON mf.project_id = p.project_id
      WHERE p.published = 1 AND p.deleted = 0
    `

    const publicMatricesQuery = `
      SELECT COUNT(*) as count
      FROM matrices m
      INNER JOIN projects p ON m.project_id = p.project_id
      WHERE p.published = 1 AND p.deleted = 0 AND m.deleted = 0
    `

    const inProgressProjectsQuery = `
      SELECT COUNT(*) as count
      FROM projects p
      WHERE p.published = 0 AND p.deleted = 0
    `

    const inProgressImagesQuery = `
      SELECT COUNT(*) as count
      FROM media_files mf
      INNER JOIN projects p ON mf.project_id = p.project_id
      WHERE p.published = 0 AND p.deleted = 0
    `

    const inProgressMatricesQuery = `
      SELECT COUNT(*) as count
      FROM matrices m
      INNER JOIN projects p ON m.project_id = p.project_id
      WHERE p.published = 0 AND p.deleted = 0 AND m.deleted = 0
    `

    const userCountQuery = `
      SELECT COUNT(*) as count
      FROM ca_users u
      WHERE u.active = 1
    `

    // Get total unique visitors (logged in users + anonymous sessions) in last 30 days
    const totalVisitorsQuery = `
      SELECT (
        (SELECT COUNT(DISTINCT user_id) 
         FROM stats_login_log 
         WHERE datetime_started >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)) +
        (SELECT COUNT(DISTINCT sl.session_key)
         FROM stats_session_log sl
         WHERE sl.datetime_started >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)
         AND sl.session_key NOT IN (
           SELECT DISTINCT session_key FROM stats_login_log 
           WHERE datetime_started >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)
         ))
      ) as count
    `

    // Execute queries in batches to avoid exhausting connection pool
    // Run 6 queries at a time instead of all 18 simultaneously
    const batchSize = 6
    const queries = [
      { name: 'uniqueLogins', query: uniqueLoginsQuery },
      { name: 'anonymousSessions', query: anonymousSessionsQuery },
      { name: 'cells', query: cellsQuery },
      { name: 'media', query: mediaQuery },
      { name: 'projectViews', query: projectViewsQuery },
      { name: 'projectDownloads', query: projectDownloadsQuery },
      { name: 'matrixViews', query: matrixViewsQuery },
      { name: 'matrixDownloads', query: matrixDownloadsQuery },
      { name: 'mediaViews', query: mediaViewsQuery },
      { name: 'mediaDownloads', query: mediaDownloadsQuery },
      { name: 'publicProjects', query: publicProjectsQuery },
      { name: 'publicImages', query: publicImagesQuery },
      { name: 'publicMatrices', query: publicMatricesQuery },
      { name: 'inProgressProjects', query: inProgressProjectsQuery },
      { name: 'inProgressImages', query: inProgressImagesQuery },
      { name: 'inProgressMatrices', query: inProgressMatricesQuery },
      { name: 'userCount', query: userCountQuery },
      { name: 'totalVisitors', query: totalVisitorsQuery },
    ]

    const results = {}
    
    // Run queries in batches
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(({ name, query }) =>
          sequelizeConn.query(query, {
            type: sequelizeConn.QueryTypes.SELECT,
          }).then(result => ({ name, result }))
        )
      )
      batchResults.forEach(({ name, result }) => {
        results[name] = result
      })
    }
    
    const uniqueLoginsResult = results.uniqueLogins
    const anonymousSessionsResult = results.anonymousSessions
    const cellsResult = results.cells
    const mediaResult = results.media
    const projectViewsResult = results.projectViews
    const projectDownloadsResult = results.projectDownloads
    const matrixViewsResult = results.matrixViews
    const matrixDownloadsResult = results.matrixDownloads
    const mediaViewsResult = results.mediaViews
    const mediaDownloadsResult = results.mediaDownloads
    const publicProjectsResult = results.publicProjects
    const publicImagesResult = results.publicImages
    const publicMatricesResult = results.publicMatrices
    const inProgressProjectsResult = results.inProgressProjects
    const inProgressImagesResult = results.inProgressImages
    const inProgressMatricesResult = results.inProgressMatrices
    const userCountResult = results.userCount
    const totalVisitorsResult = results.totalVisitors

    // Format the response
    return {
      // Recent activity stats (last 30 days)
      numUniqueLogins: parseInt(uniqueLoginsResult[0].count || 0),
      numAnonymousSessions: parseInt(anonymousSessionsResult[0].count || 0),
      numCells: parseInt(cellsResult[0].count || 0),
      numMedia: parseInt(mediaResult[0].count || 0),
      numProjectViews: parseInt(projectViewsResult[0].views || 0),
      numProjectDownloads: parseInt(projectDownloadsResult[0].downloads || 0),
      numMatrixViews: parseInt(matrixViewsResult[0].views || 0),
      numMatrixDownloads: parseInt(matrixDownloadsResult[0].downloads || 0),
      numMediaViews: parseInt(mediaViewsResult[0].views || 0),
      numMediaDownloads: parseInt(mediaDownloadsResult[0].downloads || 0),
      
      // MorphoBank overall statistics
      morphoBank: {
        publicProjectCount: parseInt(publicProjectsResult[0].count || 0),
        publicImageCount: parseInt(publicImagesResult[0].count || 0), // Note: This is total media count, not just images
        publicMatrixCount: parseInt(publicMatricesResult[0].count || 0),
        inProgressProjectCount: parseInt(inProgressProjectsResult[0].count || 0),
        inProgressImageCount: parseInt(inProgressImagesResult[0].count || 0), // Note: This is total media count, not just images
        inProgressMatrixCount: parseInt(inProgressMatricesResult[0].count || 0),
        userCount: parseInt(userCountResult[0].count || 0),
        recentVisitorCount: parseInt(totalVisitorsResult[0].count || 0),
        asOfDate: new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
      },
    }
  } catch (error) {
    console.error('Error fetching fresh stats:', error)
    throw error
  }
}

// Function to get stats (either from cache or fresh)
export const getStats = async () => {
  const now = Date.now()
  const oneDay = 24 * 60 * 60 * 1000 // 24 hours in milliseconds (changed from 1 hour)

  // If cache is empty or older than 24 hours, fetch fresh data
  if (
    !statsCache.data ||
    !statsCache.lastUpdated ||
    now - statsCache.lastUpdated > oneDay
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
    console.log('Fetching fresh stats for cache initialization...')
    const startTime = Date.now()
    statsCache.data = await fetchFreshStats()
    statsCache.lastUpdated = Date.now()
    const duration = Date.now() - startTime
    console.log(`Stats cache initialized successfully in ${duration}ms`)
  } catch (error) {
    console.error('Error initializing stats cache:', error.message)
    console.error('Stack:', error.stack)
    throw error // Re-throw to let caller handle it
  }
}
