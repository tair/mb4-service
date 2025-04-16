import sequelizeConn from './db.js';

// Cache object to store stats
let statsCache = {
  data: null,
  lastUpdated: null
};

// Function to fetch fresh stats from database
const fetchFreshStats = async () => {
  try {
    // Get unique logins in last 30 days
    const uniqueLoginsQuery = `
      SELECT COUNT(DISTINCT user_id) as count 
      FROM stats_login_log 
      WHERE datetime_started >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)
      AND datetime_started <= UNIX_TIMESTAMP(NOW())
    `;
    
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
    `;
    
    // Get total cells scored
    const cellsQuery = `
      SELECT count(*) as count
      FROM cells c
      INNER JOIN matrices m ON c.matrix_id = m.matrix_id
      INNER JOIN projects p ON m.project_id = p.project_id
      WHERE m.deleted = 0 AND p.deleted = 0
      AND m.created_on >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)
    `;
    
    // Get total media uploaded
    const mediaQuery = `
      SELECT COUNT(*) as count 
      FROM media_files m
      INNER JOIN projects p ON m.project_id = p.project_id
      WHERE p.deleted = 0
      AND m.created_on >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)
    `;
    
    // Get project views/downloads in last 30 days
    const projectViewsQuery = `
      SELECT COUNT(*) as views
      FROM stats_pub_hit_log
      WHERE hit_type = 'P'
      AND hit_datetime >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)
    `;

    const projectDownloadsQuery = `
      SELECT COUNT(*) as downloads
      FROM stats_pub_download_log
      WHERE download_type = 'P'
      AND download_datetime >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)
    `;
    
    // Get matrix views/downloads in last 30 days
    const matrixViewsQuery = `
      SELECT COUNT(*) as views
      FROM stats_pub_hit_log
      WHERE hit_type = 'X'
      AND hit_datetime >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)
    `;

    const matrixDownloadsQuery = `
      SELECT COUNT(*) as downloads
      FROM stats_pub_download_log
      WHERE download_type = 'X'
      AND download_datetime >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)
    `;
    
    // Get media views/downloads in last 30 days
    const mediaViewsQuery = `
      SELECT COUNT(*) as views
      FROM stats_pub_hit_log
      WHERE hit_type = 'M'
      AND hit_datetime >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)
    `;

    const mediaDownloadsQuery = `
      SELECT COUNT(*) as downloads
      FROM stats_pub_download_log
      WHERE download_type = 'M'
      AND download_datetime >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 DAY)
    `;

    // Execute all queries in parallel
    const [
      uniqueLoginsResult,
      anonymousSessionsResult,
      cellsResult,
      mediaResult,
      projectViewsResult,
      projectDownloadsResult,
      matrixViewsResult,
      matrixDownloadsResult,
      mediaViewsResult,
      mediaDownloadsResult
    ] = await Promise.all([
      sequelizeConn.query(uniqueLoginsQuery, { type: sequelizeConn.QueryTypes.SELECT }),
      sequelizeConn.query(anonymousSessionsQuery, { type: sequelizeConn.QueryTypes.SELECT }),
      sequelizeConn.query(cellsQuery, { type: sequelizeConn.QueryTypes.SELECT }),
      sequelizeConn.query(mediaQuery, { type: sequelizeConn.QueryTypes.SELECT }),
      sequelizeConn.query(projectViewsQuery, { type: sequelizeConn.QueryTypes.SELECT }),
      sequelizeConn.query(projectDownloadsQuery, { type: sequelizeConn.QueryTypes.SELECT }),
      sequelizeConn.query(matrixViewsQuery, { type: sequelizeConn.QueryTypes.SELECT }),
      sequelizeConn.query(matrixDownloadsQuery, { type: sequelizeConn.QueryTypes.SELECT }),
      sequelizeConn.query(mediaViewsQuery, { type: sequelizeConn.QueryTypes.SELECT }),
      sequelizeConn.query(mediaDownloadsQuery, { type: sequelizeConn.QueryTypes.SELECT })
    ]);

    // Format the response
    return {
      numUniqueLogins: parseInt(uniqueLoginsResult[0].count || 0),
      numAnonymousSessions: parseInt(anonymousSessionsResult[0].count || 0),
      numCells: parseInt(cellsResult[0].count || 0),
      numMedia: parseInt(mediaResult[0].count || 0),
      numProjectViews: parseInt(projectViewsResult[0].views || 0),
      numProjectDownloads: parseInt(projectDownloadsResult[0].downloads || 0),
      numMatrixViews: parseInt(matrixViewsResult[0].views || 0),
      numMatrixDownloads: parseInt(matrixDownloadsResult[0].downloads || 0),
      numMediaViews: parseInt(mediaViewsResult[0].views || 0),
      numMediaDownloads: parseInt(mediaDownloadsResult[0].downloads || 0)
    };
  } catch (error) {
    console.error('Error fetching fresh stats:', error);
    throw error;
  }
};

// Function to get stats (either from cache or fresh)
export const getStats = async () => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds

  // If cache is empty or older than 1 hour, fetch fresh data
  if (!statsCache.data || !statsCache.lastUpdated || (now - statsCache.lastUpdated) > oneHour) {
    try {
      statsCache.data = await fetchFreshStats();
      statsCache.lastUpdated = now;
    } catch (error) {
      // If there's an error fetching fresh data and we have cached data, return the cached data
      if (statsCache.data) {
        return statsCache.data;
      }
      throw error;
    }
  }

  return statsCache.data;
};

// Initialize the cache on startup
export const initializeCache = async () => {
  try {
    statsCache.data = await fetchFreshStats();
    statsCache.lastUpdated = Date.now();
    console.log('Stats cache initialized');
  } catch (error) {
    console.error('Error initializing stats cache:', error);
  }
}; 