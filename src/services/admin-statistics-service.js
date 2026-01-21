import sequelizeConn from '../util/db.js'

/**
 * Admin Statistics Service
 * Provides site and project statistics for admin dashboard
 * Only uses tables that exist in the current database schema
 */

/**
 * Get all-time site statistics totals
 */
export async function getSiteTotals() {
  try {
    // Run all simple count queries in parallel
    const [
      projectsResult,
      publishedProjectsResult,
      usersResult,
      mediaResult,
      taxaResult,
      matricesResult,
      specimensResult,
      charactersResult,
      cellsResult
    ] = await Promise.all([
      sequelizeConn.query(`SELECT COUNT(*) as count FROM projects WHERE deleted = 0`),
      sequelizeConn.query(`SELECT COUNT(*) as count FROM projects WHERE deleted = 0 AND published = 1`),
      sequelizeConn.query(`SELECT COUNT(*) as count FROM ca_users WHERE active = 1 AND userclass = 0`),
      sequelizeConn.query(`SELECT COUNT(*) as count FROM media_files`),
      sequelizeConn.query(`SELECT COUNT(*) as count FROM taxa`),
      sequelizeConn.query(`SELECT COUNT(*) as count FROM matrices WHERE deleted = 0`),
      sequelizeConn.query(`SELECT COUNT(*) as count FROM specimens`),
      sequelizeConn.query(`SELECT COUNT(*) as count FROM characters`),
      sequelizeConn.query(`SELECT COUNT(*) as count FROM cells`)
    ])

    return {
      numProjects: projectsResult[0][0]?.count || 0,
      numPublishedProjects: publishedProjectsResult[0][0]?.count || 0,
      numUnpublishedProjects: (projectsResult[0][0]?.count || 0) - (publishedProjectsResult[0][0]?.count || 0),
      numUsers: usersResult[0][0]?.count || 0,
      numMedia: mediaResult[0][0]?.count || 0,
      numTaxa: taxaResult[0][0]?.count || 0,
      numMatrices: matricesResult[0][0]?.count || 0,
      numSpecimens: specimensResult[0][0]?.count || 0,
      numCharacters: charactersResult[0][0]?.count || 0,
      numCells: cellsResult[0][0]?.count || 0
    }
  } catch (error) {
    console.error('Error in getSiteTotals:', error)
    throw error
  }
}

/**
 * Get date-range stats - simplified version using available tables
 */
export async function getDateRangeStats(startDate, endDate) {
  try {
    // Run all queries in parallel for speed
    const [
      projectsCreatedResult,
      projectsPublishedResult,
      usersRegisteredResult,
      mediaUploadedResult
    ] = await Promise.all([
      // Projects created in date range
      sequelizeConn.query(
        `SELECT COUNT(*) as count FROM projects 
         WHERE deleted = 0 AND created_on >= ? AND created_on <= ?`,
        { replacements: [startDate, endDate] }
      ),
      // Projects published in date range
      sequelizeConn.query(
        `SELECT COUNT(*) as count FROM projects 
         WHERE deleted = 0 AND published = 1 AND published_on IS NOT NULL 
         AND published_on >= ? AND published_on <= ?`,
        { replacements: [startDate, endDate] }
      ),
      // Users registered in date range (using approved_on, not created_on)
      sequelizeConn.query(
        `SELECT COUNT(*) as count FROM ca_users 
         WHERE approved_on IS NOT NULL AND approved_on >= ? AND approved_on <= ?`,
        { replacements: [startDate, endDate] }
      ),
      // Media uploaded in date range
      sequelizeConn.query(
        `SELECT COUNT(*) as count FROM media_files 
         WHERE created_on >= ? AND created_on <= ?`,
        { replacements: [startDate, endDate] }
      )
    ])

    return {
      projectsCreated: parseInt(projectsCreatedResult[0][0]?.count) || 0,
      projectsPublished: parseInt(projectsPublishedResult[0][0]?.count) || 0,
      usersRegistered: parseInt(usersRegisteredResult[0][0]?.count) || 0,
      mediaUploaded: parseInt(mediaUploadedResult[0][0]?.count) || 0
    }
  } catch (error) {
    console.error('Error in getDateRangeStats:', error)
    return {
      projectsCreated: 0,
      projectsPublished: 0,
      usersRegistered: 0,
      mediaUploaded: 0
    }
  }
}

/**
 * Get all date range stats at once for caching
 * Returns stats for: today, yesterday, last week, this month, last month, this year, last year
 */
export async function getAllDateRangeStats() {
  const { parseDateRange } = await import('../util/date-parser.js')
  
  const ranges = ['today', 'yesterday', 'last week', 'this month', 'last month', 'this year', 'last year']
  const results = {}
  
  // Fetch all date ranges in parallel
  await Promise.all(
    ranges.map(async (rangeName) => {
      const { start, end, displayText } = parseDateRange(rangeName)
      const stats = await getDateRangeStats(start, end)
      results[rangeName] = {
        ...stats,
        start,
        end,
        displayText
      }
    })
  )
  
  return results
}

/**
 * Get member and project statistics
 */
export async function getMemberProjectStats(startDate, endDate) {
  try {
    // New members in date range
    const [newMembers] = await sequelizeConn.query(
      `SELECT COUNT(*) as count FROM ca_users 
       WHERE created_on >= ? AND created_on <= ?`,
      { replacements: [startDate, endDate] }
    )

    // New projects in date range
    const [newProjects] = await sequelizeConn.query(
      `SELECT COUNT(*) as count FROM projects 
       WHERE deleted = 0 AND created_on >= ? AND created_on <= ?`,
      { replacements: [startDate, endDate] }
    )

    return {
      newMembers: newMembers[0]?.count || 0,
      newProjects: newProjects[0]?.count || 0
    }
  } catch (error) {
    console.error('Error in getMemberProjectStats:', error)
    return { newMembers: 0, newProjects: 0 }
  }
}

/**
 * Get login/session statistics - not available without stats tables
 */
export async function getLoginSessionStats(startDate, endDate) {
  return {
    message: 'Login statistics not available - stats tables not configured',
    numLogins: 0,
    numSessions: 0
  }
}

/**
 * Get download statistics - not available without stats tables
 */
export async function getDownloadStats(startDate, endDate) {
  return {
    message: 'Download statistics not available - stats tables not configured',
    numDownloads: 0
  }
}

/**
 * Get upload statistics - using media_files table
 */
export async function getUploadStats(startDate, endDate) {
  try {
    const [mediaUploaded] = await sequelizeConn.query(
      `SELECT COUNT(*) as count FROM media_files 
       WHERE created_on >= ? AND created_on <= ?`,
      { replacements: [startDate, endDate] }
    )

    return {
      numMediaUploaded: mediaUploaded[0]?.count || 0
    }
  } catch (error) {
    console.error('Error in getUploadStats:', error)
    return { numMediaUploaded: 0 }
  }
}

/**
 * Get login info - not available without stats tables
 */
export async function getLoginInfo(startDate, endDate) {
  return {
    message: 'Login info not available - stats tables not configured',
    logins: []
  }
}

/**
 * Get download info - not available without stats tables
 */
export async function getDownloadInfo(startDate, endDate, downloadType = null) {
  return {
    message: 'Download info not available - stats tables not configured',
    downloads: []
  }
}

/**
 * Get upload info - using media_files
 */
export async function getUploadInfo(startDate, endDate, uploadType = null) {
  try {
    const [uploads] = await sequelizeConn.query(
      `SELECT mf.media_id, mf.project_id, p.name as project_name, 
              mf.created_on, u.fname, u.lname
       FROM media_files mf
       LEFT JOIN projects p ON mf.project_id = p.project_id
       LEFT JOIN ca_users u ON mf.user_id = u.user_id
       WHERE mf.created_on >= ? AND mf.created_on <= ?
       ORDER BY mf.created_on DESC
       LIMIT 100`,
      { replacements: [startDate, endDate] }
    )

    return {
      uploads: uploads.map(u => ({
        mediaId: u.media_id,
        projectId: u.project_id,
        projectName: u.project_name,
        uploadedOn: u.created_on,
        uploadedBy: u.fname && u.lname ? `${u.fname} ${u.lname}` : 'Unknown'
      }))
    }
  } catch (error) {
    console.error('Error in getUploadInfo:', error)
    return { uploads: [] }
  }
}

/**
 * Get registration info
 */
export async function getRegistrationInfo(startDate, endDate) {
  try {
    // Use approved_on to match the stats count query
    const [registrations] = await sequelizeConn.query(
      `SELECT user_id, fname, lname, email, approved_on
       FROM ca_users
       WHERE approved_on IS NOT NULL AND approved_on >= ? AND approved_on <= ?
       ORDER BY approved_on DESC
       LIMIT 100`,
      { replacements: [startDate, endDate] }
    )

    return {
      registrations: registrations.map(r => ({
        userId: r.user_id,
        name: r.fname && r.lname ? `${r.fname} ${r.lname}` : 'Unknown',
        email: r.email,
        registeredOn: r.approved_on
      }))
    }
  } catch (error) {
    console.error('Error in getRegistrationInfo:', error)
    return { registrations: [] }
  }
}

/**
 * Get project publication info
 */
export async function getProjectPubInfo(startDate, endDate) {
  try {
    // Recently published projects
    const [published] = await sequelizeConn.query(
      `SELECT p.project_id, p.name, p.published_on, u.fname, u.lname
       FROM projects p
       LEFT JOIN ca_users u ON p.user_id = u.user_id
       WHERE p.deleted = 0 AND p.published = 1 
             AND p.published_on >= ? AND p.published_on <= ?
       ORDER BY p.published_on DESC
       LIMIT 50`,
      { replacements: [startDate, endDate] }
    )

    // Recently created projects
    const [created] = await sequelizeConn.query(
      `SELECT p.project_id, p.name, p.created_on, u.fname, u.lname
       FROM projects p
       LEFT JOIN ca_users u ON p.user_id = u.user_id
       WHERE p.deleted = 0 AND p.created_on >= ? AND p.created_on <= ?
       ORDER BY p.created_on DESC
       LIMIT 50`,
      { replacements: [startDate, endDate] }
    )

    return {
      published: published.map(p => ({
        projectId: p.project_id,
        name: p.name,
        publishedOn: p.published_on,
        admin: p.fname && p.lname ? `${p.fname} ${p.lname}` : 'Unknown'
      })),
      created: created.map(p => ({
        projectId: p.project_id,
        name: p.name,
        createdOn: p.created_on,
        admin: p.fname && p.lname ? `${p.fname} ${p.lname}` : 'Unknown'
      }))
    }
  } catch (error) {
    console.error('Error in getProjectPubInfo:', error)
    return { published: [], created: [] }
  }
}

/**
 * Get location info - not available without stats tables
 */
export async function getLocationInfo(startDate, endDate) {
  return {
    message: 'Location info not available - stats tables not configured',
    locations: []
  }
}

/**
 * Get project statistics totals
 */
export async function getProjectStatsTotals() {
  try {
    const [
      projectsResult,
      publishedResult,
      matricesResult,
      taxaResult,
      mediaResult,
      charactersResult,
      cellsResult,
      membersResult,
      cipresResult
    ] = await Promise.all([
      sequelizeConn.query(`SELECT COUNT(*) as count FROM projects WHERE deleted = 0`),
      sequelizeConn.query(`SELECT COUNT(*) as count FROM projects WHERE deleted = 0 AND published = 1`),
      sequelizeConn.query(`SELECT COUNT(*) as count FROM matrices WHERE deleted = 0`),
      sequelizeConn.query(`SELECT COUNT(*) as count FROM taxa`),
      sequelizeConn.query(`SELECT COUNT(*) as count FROM media_files`),
      sequelizeConn.query(`SELECT COUNT(*) as count FROM characters`),
      sequelizeConn.query(`SELECT COUNT(*) as count FROM cells`),
      sequelizeConn.query(`SELECT COUNT(DISTINCT user_id) as count FROM projects_x_users`),
      sequelizeConn.query(`SELECT COUNT(*) as count FROM cipres_requests`)
    ])

    return {
      numProjects: projectsResult[0][0]?.count || 0,
      numPublished: publishedResult[0][0]?.count || 0,
      numUnpublished: (projectsResult[0][0]?.count || 0) - (publishedResult[0][0]?.count || 0),
      numMatrices: matricesResult[0][0]?.count || 0,
      numTaxa: taxaResult[0][0]?.count || 0,
      numMedia: mediaResult[0][0]?.count || 0,
      numCharacters: charactersResult[0][0]?.count || 0,
      numCells: cellsResult[0][0]?.count || 0,
      numUniqueMembers: membersResult[0][0]?.count || 0,
      numCipresRequests: cipresResult[0][0]?.count || 0
    }
  } catch (error) {
    console.error('Error in getProjectStatsTotals:', error)
    throw error
  }
}

/**
 * Get paginated project list with basic stats
 */
export async function getProjectsListPaginated({ limit = 50, offset = 0, sort = 'project_id', order = 'DESC', search = '' }) {
  try {
    // Validate sort field
    const allowedSortFields = ['project_id', 'name', 'published', 'created_on', 'last_accessed_on']
    const sortField = allowedSortFields.includes(sort) ? sort : 'project_id'
    const sortOrder = order === 'ASC' ? 'ASC' : 'DESC'

    // Build search condition
    let whereClause = 'WHERE p.deleted = 0'
    const replacements = { limit, offset }
    
    if (search) {
      whereClause += ' AND p.name LIKE :search'
      replacements.search = `%${search}%`
    }

    // Get total count
    const [countResult] = await sequelizeConn.query(
      `SELECT COUNT(*) as total FROM projects p ${whereClause}`,
      { replacements }
    )
    const totalCount = countResult[0]?.total || 0

    // Get paginated projects with basic info
    const [projects] = await sequelizeConn.query(
      `SELECT 
         p.project_id,
         p.name,
         p.published,
         p.created_on,
         p.last_accessed_on,
         u.user_id as admin_user_id,
         u.fname as admin_fname,
         u.lname as admin_lname
       FROM projects p
       LEFT JOIN ca_users u ON p.user_id = u.user_id
       ${whereClause}
       ORDER BY p.${sortField} ${sortOrder}
       LIMIT :limit OFFSET :offset`,
      { replacements }
    )

    // Get counts for these projects in batch
    const projectIds = projects.map(p => p.project_id)
    
    if (projectIds.length === 0) {
      return { projects: [], totalCount }
    }

    // Get matrix counts
    const [matrixCounts] = await sequelizeConn.query(
      `SELECT project_id, COUNT(*) as count 
       FROM matrices 
       WHERE project_id IN (:projectIds) AND deleted = 0
       GROUP BY project_id`,
      { replacements: { projectIds } }
    )
    const matrixMap = new Map(matrixCounts.map(m => [m.project_id, m.count]))

    // Get taxa counts
    const [taxaCounts] = await sequelizeConn.query(
      `SELECT project_id, COUNT(*) as count 
       FROM taxa 
       WHERE project_id IN (:projectIds)
       GROUP BY project_id`,
      { replacements: { projectIds } }
    )
    const taxaMap = new Map(taxaCounts.map(t => [t.project_id, t.count]))

    // Get media counts
    const [mediaCounts] = await sequelizeConn.query(
      `SELECT project_id, COUNT(*) as count 
       FROM media_files 
       WHERE project_id IN (:projectIds)
       GROUP BY project_id`,
      { replacements: { projectIds } }
    )
    const mediaMap = new Map(mediaCounts.map(m => [m.project_id, m.count]))

    // Get member counts
    const [memberCounts] = await sequelizeConn.query(
      `SELECT project_id, COUNT(DISTINCT user_id) as count 
       FROM projects_x_users 
       WHERE project_id IN (:projectIds)
       GROUP BY project_id`,
      { replacements: { projectIds } }
    )
    const memberMap = new Map(memberCounts.map(m => [m.project_id, m.count]))

    // Format results
    const formattedProjects = projects.map(project => ({
      projectId: project.project_id,
      name: project.name,
      administrator: project.admin_fname && project.admin_lname
        ? `${project.admin_fname} ${project.admin_lname}`
        : 'Unknown',
      published: project.published === 1,
      createdOn: project.created_on,
      lastAccessedOn: project.last_accessed_on,
      numMatrices: matrixMap.get(project.project_id) || 0,
      numTaxa: taxaMap.get(project.project_id) || 0,
      numMedia: mediaMap.get(project.project_id) || 0,
      numMembers: memberMap.get(project.project_id) || 0
    }))

    return {
      projects: formattedProjects,
      totalCount
    }
  } catch (error) {
    console.error('Error in getProjectsListPaginated:', error)
    throw error
  }
}

/**
 * Get detailed statistics for a single project
 */
export async function getProjectDetailedStats(projectId) {
  try {
    // Get basic project info
    const [projects] = await sequelizeConn.query(
      `SELECT 
         p.project_id,
         p.name,
         p.published,
         p.created_on,
         p.last_accessed_on,
         u.user_id as admin_user_id,
         u.fname as admin_fname,
         u.lname as admin_lname
       FROM projects p
       LEFT JOIN ca_users u ON p.user_id = u.user_id
       WHERE p.project_id = :projectId AND p.deleted = 0`,
      { replacements: { projectId } }
    )

    if (!projects.length) {
      return null
    }

    const project = projects[0]

    // Get all counts in parallel
    const [
      matrixCount,
      taxaCount,
      mediaCount,
      memberCount,
      characterCount,
      cellCount,
      specimenCount,
      docCount,
      partitionCount,
      cipresCount
    ] = await Promise.all([
      sequelizeConn.query(
        `SELECT COUNT(*) as count FROM matrices WHERE project_id = :projectId AND deleted = 0`,
        { replacements: { projectId } }
      ),
      sequelizeConn.query(
        `SELECT COUNT(*) as count FROM taxa WHERE project_id = :projectId`,
        { replacements: { projectId } }
      ),
      sequelizeConn.query(
        `SELECT COUNT(*) as count FROM media_files WHERE project_id = :projectId`,
        { replacements: { projectId } }
      ),
      sequelizeConn.query(
        `SELECT COUNT(DISTINCT user_id) as count FROM projects_x_users WHERE project_id = :projectId`,
        { replacements: { projectId } }
      ),
      sequelizeConn.query(
        `SELECT COUNT(*) as count FROM characters WHERE project_id = :projectId`,
        { replacements: { projectId } }
      ),
      sequelizeConn.query(
        `SELECT COUNT(*) as count FROM cells c 
         INNER JOIN matrices m ON c.matrix_id = m.matrix_id
         WHERE m.project_id = :projectId AND m.deleted = 0`,
        { replacements: { projectId } }
      ),
      sequelizeConn.query(
        `SELECT COUNT(*) as count FROM specimens WHERE project_id = :projectId`,
        { replacements: { projectId } }
      ),
      sequelizeConn.query(
        `SELECT COUNT(*) as count FROM project_documents WHERE project_id = :projectId`,
        { replacements: { projectId } }
      ),
      sequelizeConn.query(
        `SELECT COUNT(*) as count FROM partitions WHERE project_id = :projectId`,
        { replacements: { projectId } }
      ),
      // cipres_requests joins through matrix_id, not project_id
      sequelizeConn.query(
        `SELECT COUNT(*) as count FROM cipres_requests cr
         INNER JOIN matrices m ON cr.matrix_id = m.matrix_id
         WHERE m.project_id = :projectId AND m.deleted = 0`,
        { replacements: { projectId } }
      )
    ])

    return {
      projectId: project.project_id,
      name: project.name,
      administrator: project.admin_fname && project.admin_lname
        ? `${project.admin_fname} ${project.admin_lname}`
        : 'Unknown',
      published: project.published === 1,
      createdOn: project.created_on,
      lastAccessedOn: project.last_accessed_on,
      numMatrices: parseInt(matrixCount[0][0]?.count) || 0,
      numTaxa: parseInt(taxaCount[0][0]?.count) || 0,
      numMedia: parseInt(mediaCount[0][0]?.count) || 0,
      numMembers: parseInt(memberCount[0][0]?.count) || 0,
      numCharacters: parseInt(characterCount[0][0]?.count) || 0,
      numCells: parseInt(cellCount[0][0]?.count) || 0,
      numSpecimens: parseInt(specimenCount[0][0]?.count) || 0,
      numDocs: parseInt(docCount[0][0]?.count) || 0,
      numPartitions: parseInt(partitionCount[0][0]?.count) || 0,
      numCipresRequests: parseInt(cipresCount[0][0]?.count) || 0
    }
  } catch (error) {
    console.error('Error in getProjectDetailedStats:', error)
    throw error
  }
}

// Keep the old function for backwards compatibility but mark as deprecated
export async function getProjectsList() {
  console.warn('getProjectsList is deprecated, use getProjectsListPaginated instead')
  const result = await getProjectsListPaginated({ limit: 1000, offset: 0 })
  return result.projects
}
