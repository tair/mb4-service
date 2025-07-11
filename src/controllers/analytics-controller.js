import sequelizeConn from '../util/db.js'

// Log a project view
export async function logProjectView(req, res) {
  try {
    const { project_id, hit_type = 'P', row_id = null } = req.body
    const user_id = req.user?.user_id
    // For testing so no auth is required
    // const session_key = req.headers['x-session-key'] || 'testsession1234567890'
    const session_key = req.headers['x-session-key']
    if (!project_id) {
      return res.status(400).json({ message: 'project_id is required' })
    }
    await sequelizeConn.query(
      `INSERT INTO stats_pub_hit_log (session_key, user_id, hit_datetime, hit_type, project_id, row_id)
       VALUES (?, ?, UNIX_TIMESTAMP(), ?, ?, ?)`,
      { replacements: [session_key, user_id, hit_type, project_id, row_id] }
    )
    res.status(200).json({ message: 'Project view logged' })
  } catch (e) {
    console.error('Error logging project view:', e)
    res.status(500).json({ message: 'Failed to log project view' })
  }
}

// Log a download
export async function logDownload(req, res) {
  try {
    const { project_id, download_type, row_id = null } = req.body
    const user_id = req.user?.user_id
    // For testing so no auth is required
    // const session_key = req.headers['x-session-key'] || 'testsession1234567890'
    const session_key = req.headers['x-session-key']
    if (!project_id || !download_type) {
      return res
        .status(400)
        .json({ message: 'project_id and download_type are required' })
    }
    await sequelizeConn.query(
      `INSERT INTO stats_pub_download_log (session_key, user_id, download_datetime, download_type, project_id, row_id)
       VALUES (?, ?, UNIX_TIMESTAMP(), ?, ?, ?)`,
      {
        replacements: [session_key, user_id, download_type, project_id, row_id],
      }
    )
    res.status(200).json({ message: 'Download logged' })
  } catch (e) {
    console.error('Error logging download:', e)
    res.status(500).json({ message: 'Failed to log download' })
  }
}
