import sequelizeConn from '../util/db.js'

async function fetchInstitutions(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT ins.name, ins.institution_id
      FROM institutions ins
      INNER JOIN institutions_x_projects insp
      ON ins.institution_id = insp.institution_id AND insp.project_id = ?`,
    { replacements: [projectId] }
  )

  return rows
}

export { fetchInstitutions }
