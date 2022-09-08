import sequelizeConn from '../util/db.js';

async function getMatricesByProject(project_id) {
  const [rows, metadata] = await sequelizeConn.query(
    `select matrix_id, title, user_id
      from matrices
      where project_id=${project_id}`
  )
  return rows
}

export {getMatricesByProject}
