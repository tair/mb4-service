import sequelizeConn from '../util/db.js'

export async function getProjectSpecimens(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT s.*, ts.taxon_id
      FROM specimens AS s
      LEFT JOIN taxa_x_specimens AS ts ON s.specimen_id = ts.specimen_id
      WHERE s.project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
}

export async function getSpecimenDetails(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT s.reference_source, s.institution_code,s.user_id,
          s.collection_code, s.catalog_number, s.created_on, u.fname, u.lname,
          t.*
      FROM specimens s
      INNER JOIN taxa_x_specimens ts ON s.specimen_id = ts.specimen_id
      INNER JOIN taxa t ON t.taxon_id = ts.taxon_id
      INNER JOIN ca_users u ON u.user_id = s.user_id AND s.project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
}
