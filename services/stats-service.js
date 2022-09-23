import sequelizeConn from '../util/db.js';

async function getProjectStats(projectId) {
  const [rows] = await sequelizeConn.query(
    'SELECT * FROM stats_projects_overview WHERE project_id = ?',
    { replacements: [projectId] }
  )
  return rows[0]
}

export {getProjectStats}