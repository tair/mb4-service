import sequelizeConn from '../util/db.js'

export async function fetchInstitutions(projectId) {
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

/**
 * returns an array of all Institution references outside current project
 * @param {number[]} institutionIds
 * @param {number} projectId
 * @returns {number[]}
 */
export async function getInstitutionIdsReferencedOutsideProject(
  institutionIds,
  projectId
) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT DISTINCT institution_id
      FROM (
        SELECT institution_id
        FROM institutions_x_projects
        WHERE institution_id in (:institutionIds) AND project_id != :projectId
        UNION
        SELECT institution_id
        FROM institutions_x_users
        WHERE institution_id in (:institutionIds)
      ) AS combined`,
    { replacements: { institutionIds: institutionIds, projectId: projectId } }
  )
  return rows.map((r) => r.institution_id)
}
