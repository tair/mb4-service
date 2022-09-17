const sequelize = require('../util/db.js')

async function getPartitions(projectId) {
  const [rows] = await sequelize.query(`
      SELECT partition_id, name 
      FROM partitions
      WHERE project_id = ?
      ORDER BY name`,
    { replacements: [projectId] }
  )
  return rows
}

module.exports = {
  getPartitions,
}
