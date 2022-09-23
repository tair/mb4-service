import sequelizeConn from '../util/db.js';
import * as mediaService from './media-service.js';
import * as statsService from './stats-service.js';

async function getProjects() {

  let [rows] = await sequelizeConn.query(`
      SELECT p.project_id, journal_year, article_authors, article_title
      FROM projects p
      WHERE p.published = 1 AND p.deleted = 0
      ORDER BY p.published_on desc`
  )

  for (let i = 0; i < rows.length; i++) {
    const prj_stats = await statsService.getProjectStats(rows[i].project_id)

    const image_props = await mediaService.getImageProps(rows[i].project_id, 'preview')
    rows[i] = {
      image_props: image_props,
      project_stats: prj_stats,
      ...rows[i],
    }
  }

  return rows
}

export {getProjects}