import sequelizeConn from '../util/db.js'

async function getProjectStats(projectId) {
  const [rows] = await sequelizeConn.query(
    'SELECT * FROM stats_projects_overview WHERE project_id = ?',
    { replacements: [projectId] }
  )
  return rows[0]
}

async function getProjectViewsForLast30Days() {
  const [rows] = await sequelizeConn.query(
    `select s.project_id as project_id, count(s.project_id) as views, p.name
    from stats_pub_hit_log s, projects p 
    where s.project_id = p.project_id
    and hit_type='P'
    and hit_datetime > UNIX_TIMESTAMP(CURRENT_DATE - INTERVAL 30 DAY)
    group by s.project_id order by count(s.project_id) desc limit 50`
  )
  return rows
}

async function getMediaViewsForLast30Days() {
  const [rows] = await sequelizeConn.query(
    `select s.row_id as media_id, count(s.row_id) as views, p.name, p.project_id
    from stats_pub_hit_log s, media_files m, projects p
     where s.row_id=m.media_id and
     m.project_id = p.project_id and
     hit_type='M' 
    and hit_datetime > UNIX_TIMESTAMP(CURRENT_DATE - INTERVAL 30 DAY) 
    group by s.row_id order by count(s.row_id) desc limit 50`
  )
  return rows
}

async function getMatrixDownloadsForLast30Days() {
  const [rows] = await sequelizeConn.query(
    `select s.row_id as matrix_id, count(s.row_id) as downloads,
    m.title as matrix, p.project_id as project_id, p.name as project
    from stats_pub_download_log s, matrices m, projects p
    where download_type='X' 
    and s.row_id = m.matrix_id and m.project_id = p.project_id
    and download_datetime > UNIX_TIMESTAMP(CURRENT_DATE - INTERVAL 30 DAY) 
    group by s.row_id order by count(s.row_id) desc limit 50`
  )
  return rows
}

async function getDocDownloadsForLast30Days() {
  const [rows] = await sequelizeConn.query(
    `select s.row_id as doc_id, count(s.row_id) as downloads,
    d.title as doc, p.project_id as project_id, p.name as project
    from stats_pub_download_log s, project_documents d, projects p
    where download_type='D'
    and s.row_id = d.document_id and d.project_id = p.project_id
    and download_datetime > UNIX_TIMESTAMP(CURRENT_DATE - INTERVAL 30 DAY) 
    group by s.row_id order by count(s.row_id) desc limit 50`
  )
  return rows
}

export {
  getProjectStats,
  getProjectViewsForLast30Days,
  getMediaViewsForLast30Days,
  getMatrixDownloadsForLast30Days,
  getDocDownloadsForLast30Days,
}
