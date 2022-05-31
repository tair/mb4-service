const sequelize = require('../util/db.js')

async function getProjectStats(project_id) {
  const [rows, metadata] = await sequelize.query(
    `select * from stats_projects_overview where project_id=${project_id}`
  )
  return rows[0]
}

module.exports = {
  getProjectStats,
}
