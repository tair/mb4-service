import sequelizeConn from '../util/db.js'
import * as mediaService from './media-service.js'
import * as statsService from './stats-service.js'

async function getProjects() {
  let [rows] = await sequelizeConn.query(`
      SELECT p.project_id, journal_year, article_authors, article_title
      FROM projects p
      WHERE p.published = 1 AND p.deleted = 0
      ORDER BY p.published_on desc`)

  for (let i = 0; i < rows.length; i++) {
    const prj_stats = await statsService.getProjectStats(rows[i].project_id)

    const image_props = await mediaService.getImageProps(
      rows[i].project_id,
      'preview'
    )
    rows[i] = {
      image_props: image_props,
      project_stats: prj_stats,
      ...rows[i],
    }
  }

  return rows
}

async function getProjectTitles(order) {
  console.log('tet')
  let sort_by = 'ASC'
  if (order.toUpperCase() === 'DESC') sort_by = 'DESC'

  let [rows] = await sequelizeConn.query(`
  select project_id, name from projects 
 where published=1 and deleted=0
 order by name ${sort_by}`)

  return rows
}

async function getAuthorsWithProjects() {
  let [rows] =
    await sequelizeConn.query(`select CONCAT(u.fname, ' ', u.lname) as author, 
    p.project_id, 
    p.name
 from projects_x_users pu, ca_users u, projects p
 where pu.user_id = u.user_id and p.project_id=pu.project_id
 and p.published=1 and p.deleted=0
 order by CONCAT(u.fname, ' ', u.lname)`)

  let authors = {}

  for (let i = 0; i < rows.length; i++) {
    let author = rows[i].author
    let project = {
      id: rows[i].project_id,
      name: rows[i].name,
    }

    if (!authors[author]) {
      authors[author] = [project]
    } else {
      authors[author].push(project)
    }
  }

  return authors
}

export { getProjects, getProjectTitles, getAuthorsWithProjects }
