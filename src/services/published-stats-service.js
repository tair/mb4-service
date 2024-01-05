import sequelizeConn from '../util/db.js'

export async function getProjectViewsForLast30Days() {
  const [rows] = await sequelizeConn.query(`
    SELECT
      s.project_id as project_id, count(s.project_id) as views, p.name
    FROM stats_pub_hit_log s
    INNER JOIN projects AS p ON s.project_id = p.project_id
    WHERE
      s.hit_type='P' AND
      s.hit_datetime > UNIX_TIMESTAMP(CURRENT_DATE - INTERVAL 30 DAY)
    GROUP BY s.project_id
    ORDER BY views
    DESC limit 50`)
  return rows
}

export async function getMediaViewsForLast30Days() {
  const [rows] = await sequelizeConn.query(
    `SELECT
      s.row_id as media_id, count(s.row_id) as views, p.name, p.project_id
    FROM stats_pub_hit_log s
    INNER JOIN media_files AS m ON s.row_id=m.media_id
    INNER JOIN projects AS p ON m.project_id = p.project_id
    WHERE
      hit_type='M' AND
      hit_datetime > UNIX_TIMESTAMP(CURRENT_DATE - INTERVAL 30 DAY) 
    GROUP BY s.row_id
    ORDER BY views
    DESC limit 50`
  )
  return rows
}

export async function getMatrixDownloadsForLast30Days() {
  const [rows] = await sequelizeConn.query(`
    SELECT
      s.row_id as matrix_id, count(s.row_id) as downloads, m.title as matrix,
      p.project_id as project_id, p.name as project
    FROM stats_pub_download_log s
    INNER JOIN matrices AS m ON s.row_id = m.matrix_id
    INNER JOIN projects AS p ON m.project_id = p.project_id
    WHERE
      download_type='X' AND
      download_datetime > UNIX_TIMESTAMP(CURRENT_DATE - INTERVAL 30 DAY) 
    GROUP BY s.row_id
    ORDER BY count(s.row_id)
    DESC limit 50`)
  return rows
}

export async function getDocDownloadsForLast30Days() {
  const [rows] = await sequelizeConn.query(`
    SELECT
      s.row_id as doc_id, count(s.row_id) as downloads, d.title as doc,
      p.project_id as project_id, p.name as project
    FROM stats_pub_download_log s
    INNER JOIN project_documents AS d ON d.document_id = s.row_id
    INNER JOIN projects AS p ON p.project_id = d.project_id
    WHERE
      s.download_type = 'D' AND
      download_datetime > UNIX_TIMESTAMP(CURRENT_DATE - INTERVAL 30 DAY) 
    GROUP BY s.row_id
    ORDER BY count(s.row_id)
    DESC limit 50`)
  return rows
}

export async function getProjectViews(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT hit_type, row_id, count(*) as count
      FROM stats_pub_hit_log
      WHERE project_id = ?
      GROUP BY hit_type, row_id
      ORDER BY hit_type, row_id`,
    { replacements: [projectId] }
  )
  return rows
}

export async function getProjectDownloads(projectId) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT download_type, row_id, count(*) as count
    FROM stats_pub_download_log
    WHERE project_id = ?
    GROUP BY download_type, row_id
    ORDER BY download_type, row_id`,
    { replacements: [projectId] }
  )
  return rows
}
