const sequelize = require('../util/db.js')

async function getBibliography(project_id) {
  const [rows, metadata] = await sequelize.query(
    `select 
      reference_id, article_title, journal_title,
      authors, vol, pubyear, collation
  from bibliographic_references where project_id=${project_id}`
  )
  return rows
}

module.exports = {
  getBibliography,
}
