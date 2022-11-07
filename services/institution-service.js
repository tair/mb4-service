import sequelizeConn from '../util/db.js'

async function fetchInstitutions(projectId) {
  let [rows] = await sequelizeConn.query(
    `
      SELECT ins.name as name
      FROM institutions ins
      INNER JOIN institutions_x_projects insp
      ON ins.institution_id = insp.institution_id AND insp.project_id = ?`,
    { replacements: [projectId] }
  )

  let res = []
  for (var i in rows) {
    res.push(rows[i].name)
  }
  return res
}

export { fetchInstitutions }
