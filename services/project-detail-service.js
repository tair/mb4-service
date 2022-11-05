import sequelizeConn from '../util/db.js'
import * as matrixService from './matrix-service.js'
import * as statsService from './stats-service.js'
import * as mediaService from './media-service.js'
import * as institutionService from './institution-service.js'
import * as membersService from './members-service.js'
import * as taxaService from '../services/taxa-service.js'
import * as specimenService from '../services/specimen-service.js'
import * as bibService from '../services/bibliography-service.js'
import * as partitionService from '../services/partition-service.js'
import * as docsService from '../services/document-service.js'

async function getProjectViews(projectId) {
  let [rows] = await sequelizeConn.query(
    `
      SELECT hit_type, count(*) as count
      FROM stats_pub_hit_log
      WHERE project_id = ?
      GROUP BY hit_type`,
    { replacements: [projectId] }
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

async function getProjectDownloads(projectId) {
  let [rows] = await sequelizeConn.query(
    `
      SELECT download_type, count(*) as count
      FROM stats_pub_download_log
      WHERE project_id = ?
      GROUP BY download_type`,
    { replacements: [projectId] }
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

async function getProjectOverview(projectId) {
  const summary = await getProjectSummary(projectId)
  const matrices = await matrixService.getMatrices(projectId)
  const taxas = await taxaService.buildTaxa(projectId, matrices)
  const prj_stats = await statsService.getProjectStats(projectId)
  const image_props = await mediaService.getImageProps(projectId, 'small')
  const insts = await institutionService.fetchInstitutions(projectId)
  const project_views = await getProjectViews(projectId)
  const project_downloads = await getProjectDownloads(projectId)
  const members = await membersService.getMembersList(projectId)

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

async function getProjectSummary(projectId) {
  let [rows] = await sequelizeConn.query(
    `
      SELECT project_id, name, description, user_id, published, created_on,
          journal_title, journal_url, journal_volume, journal_number,
          journal_cover, journal_year, article_authors, article_title,
          article_pp, group_id, published_on, exemplar_media_id,
          partition_published_on, article_doi, project_doi
      FROM projects
      WHERE project_id = ?`,
    { replacements: [projectId] }
  )
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

export { getProjectDetails }
