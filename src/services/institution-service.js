import sequelizeConn from '../util/db.js'

export async function fetchInstitutions(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT ins.name, ins.institution_id
      FROM institutions ins
      INNER JOIN institutions_x_projects insp
      ON ins.institution_id = insp.institution_id AND insp.project_id = ?
      ORDER BY ins.name ASC`,
    { replacements: [projectId] }
  )

  return rows
}

/**
 * Returns an array of institution IDs based on the given institution IDs that
 * are referenced outside of the given project.
 *
 * @async
 * @param {number[]} institutionIds The institutions to determine if they are
 *     referenced outside of a given project.
 * @param {number} projectId The project to exclude.
 * @returns {Promise<number[]>} The institution IDs are referenced outside of
 *     the project.
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
