import sequelizeConn from '../util/db.js';
import * as mediaService from './media-service.js';
import * as statsService from './stats-service.js';

async function getProjects() {
  let [rows, metadata] = await sequelizeConn.query(
    `select
      p.project_id, journal_year, article_authors, article_title
    from projects p where p.published=1 and p.deleted=0
    order by p.published_on desc`
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