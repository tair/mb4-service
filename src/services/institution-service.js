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

async function getInstitutionUserReferences(institutionIds) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT institution_id
      FROM institutions_x_users
      WHERE institution_id in (?)`,
    { replacements: [institutionIds] }
  )

  return rows
}

async function getInstitutionProjectReferences(projectId, institutionIds) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT institution_id
      FROM institutions_x_projects
      WHERE institution_id in (?) AND project_id != ?`,
    { replacements: [institutionIds, projectId] }
  )
  return rows
}

export {
  fetchInstitutions,
  getInstitutionProjectReferences,
  getInstitutionUserReferences,
}
