const sequelize = require('../util/db.js')

async function getProjectStats(projectId) {
  const [rows] = await sequelize.query(
    'SELECT * FROM stats_projects_overview WHERE project_id = ?',
    { replacements: [projectId] }
  )
  return rows[0]
}

module.exports = {
  getProjectStats,
}
