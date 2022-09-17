const sequelize = require('../util/db.js')

async function getMatricesByProject(projectId) {
  const [rows] = await sequelize.query(`
      SELECT matrix_id, title, user_id
      FROM matrices
      WHERE project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
}

module.exports = {
  getMatricesByProject,
}
