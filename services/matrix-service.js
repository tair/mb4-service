const sequelize = require('../util/db.js')

async function getMatricesByProject(project_id) {
  const [rows, metadata] = await sequelize.query(
    `select matrix_id, title, user_id
      from matrices
      where project_id=${project_id}`
  )
  return rows
}

module.exports = {
  getMatricesByProject,
}
