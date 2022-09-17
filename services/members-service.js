const sequelize = require('../util/db.js')

async function getMembersList(projectId) {
  const [rows] = await sequelize.query(`
    SELECT smo.*
    FROM stats_members_overview smo
    LEFT JOIN projects_x_users AS pxu ON smo.project_id = pxu.project_id AND smo.user_id = pxu.user_id
    WHERE smo.project_id = ?  and fname != '' and lname != ''
    ORDER BY administrator DESC, lname, fname`,
    { replacements: [projectId] }
  )
  return rows
}

module.exports = {
  getMembersList,
}
