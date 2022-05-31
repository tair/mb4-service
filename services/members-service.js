const sequelize = require('../util/db.js')

async function getMembersList(project_id) {
  const [rows, metadata] = await sequelize.query(
    `SELECT smo.*
    FROM stats_members_overview smo
    LEFT JOIN projects_x_users AS pxu ON smo.project_id = pxu.project_id AND smo.user_id = pxu.user_id
    WHERE smo.project_id = ${project_id}  and fname != '' and lname != ''
    ORDER BY administrator DESC, lname, fname`
  )
  return rows
}

module.exports = {
  getMembersList,
}
