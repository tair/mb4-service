import sequelizeConn from '../util/db.js'

export async function getProjectsForUser(userId) {
  const [projects] = await sequelizeConn.query(
    `
    SELECT
      p.project_id, p.name, p.created_on, p.published, p.exemplar_media_id,
      p.article_authors, p.journal_year, p.article_title, p.journal_title,
      p.journal_volume, p.journal_number, p.article_pp,  p.journal_cover,
      p.journal_in_press, p.last_accessed_on,
      pu.last_accessed_on AS user_last_accessed_on
    FROM projects AS p
    INNER JOIN projects_x_users AS pu ON pu.project_id = p.project_id
    WHERE p.deleted = 0 AND pu.user_id = ?
    ORDER BY p.published, p.project_id`,
    { replacements: [userId] }
  )
  return projects
}

export async function getProject(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT project_id, name, description, user_id, published, created_on,
          journal_title, journal_url, journal_volume, journal_number,
          journal_cover, journal_year, article_authors, article_title,
          article_pp, group_id, published_on, exemplar_media_id,
          partition_published_on, article_doi, project_doi, nsf_funded,
          disk_usage, disk_usage_limit, publish_cc0
      FROM projects
      WHERE project_id = ?`,
    { replacements: [projectId] }
  )
  return rows.length > 0 ? rows[0] : {}
}
