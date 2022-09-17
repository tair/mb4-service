const sequelize = require('../util/db.js')

async function getBibliography(projectId) {
  const [rows] = await sequelize.query(`
      SELECT reference_id, article_title, journal_title, authors, vol, pubyear,
          collation
      FROM bibliographic_references
      WHERE project_id= ? `,
    { replacements: [projectId] }
  )
  return rows
}

module.exports = {
  getBibliography,
}
