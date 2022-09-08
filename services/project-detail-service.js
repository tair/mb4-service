import sequelizeConn from '../util/db.js';
import * as matrixService from './matrix-service.js';
import * as statsService from './stats-service.js';
import * as mediaService from './media-service.js';
import * as instService from './inst-service.js';
import * as membersService from './members-service.js';
import * as taxaService from '../services/taxa-service.js';
import * as specimenService from '../services/specimen-service.js';
import * as bibService from '../services/bibliography-service.js';
import * as partitionService from '../services/partition-service.js';
import * as docsService from '../services/document-service.js';

async function getProjectViews(project_id) {
  let [rows, metadata] = await sequelizeConn.query(
    `select hit_type, count(*) as count from stats_pub_hit_log
    where project_id=${project_id} group by hit_type`
  )
  let total = 0
  let views = {}
  for (let i = 0; i < rows.length; i++) {
    const key = rows[i]['hit_type']
    const val = rows[i]['count']
    views[key] = val
    total += val
  }
  views['total'] = total

  return views
}

async function getProjectDownloads(project_id) {
  let [rows, metadata] = await sequelizeConn.query(
    `SELECT download_type, count(*) as count
    FROM stats_pub_download_log
    WHERE project_id=${project_id} group by download_type`
  )

  let total = 0
  let res = {}
  for (let i = 0; i < rows.length; i++) {
    const key = rows[i]['download_type']
    const val = rows[i]['count']
    res[key] = val
    total += val
  }
  res['total'] = total

  return res
}

async function getProjectOverview(project_id) {
  const summary = await getProjectSummary(project_id)
  const matrices = await matrixService.getMatricesByProject(project_id)
  const taxas = await taxaService.buildTaxas(project_id, matrices)
  const prj_stats = await statsService.getProjectStats(project_id)
  const image_props = await mediaService.getImageProps(project_id, 'small')
  const insts = await instService.fetchInstitutions(project_id)
  const project_views = await getProjectViews(project_id)
  const project_downloads = await getProjectDownloads(project_id)
  const members = await membersService.getMembersList(project_id)

  const result = {
    members: members,
    project_downloads: project_downloads,
    project_views: project_views,
    matrices: matrices,
    institutions: insts,
    image_props: image_props,
    stats: prj_stats,
    taxas: taxas,
    ...summary,
  }

  return result
}

async function getProjectSummary(project_id) {
  let [rows, metadata] =
    await sequelizeConn.query(`SELECT project_id, name, description, 
  user_id, published, created_on, 
  journal_title, journal_url, journal_volume, journal_number, journal_cover, journal_year,
  article_authors, article_title, article_pp,
  group_id, published_on, 
  exemplar_media_id, partition_published_on, 
  article_doi, project_doi
  FROM projects
  WHERE project_id=${project_id}`)

  if (rows) return rows[0]
  return {}
}

async function getProjectDetails(projectId) {
  try {
    const overview = await getProjectOverview(projectId)
    const taxa_details = await taxaService.getTaxaDetails(projectId)
    const partitions = await partitionService.getPartitions(projectId)
    const bibliography = await bibService.getBibliography(projectId)
    const docs = await docsService.getDocuments(projectId)
    const specimen_details = await specimenService.getSpecimenDetails(projectId)
    const media_views = await mediaService.getMediaViews(projectId)

    let result = {
      overview: overview,
      media_views: media_views,
      specimen_details: specimen_details,
      docs: docs,
      bibliography: bibliography,
      partitions: partitions,
      taxa_details: taxa_details,
    }
    return result
  } catch (err) {
    console.error(
      `Error while getting project details (service). `,
      err.message
    )
    return null
  }
}

export {getProjectDetails}