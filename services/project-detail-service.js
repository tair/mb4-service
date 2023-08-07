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

async function getMatrixMap() {
  const [rows] = await sequelizeConn.query(
    `select matrix_id, title from matrices`
  )
  const map = rows.reduce((map, row) => {
    map[row.matrix_id] = row.title
    return map
  }, {})
  return map
}

async function getFolioMap() {
  const [rows] = await sequelizeConn.query(`select folio_id, name from folios`)
  const map = rows.reduce((map, row) => {
    map[row.folio_id] = row.name
    return map
  }, {})
  return map
}

async function getDocumentMap() {
  const [rows] = await sequelizeConn.query(
    `select document_id, title from project_documents`
  )
  const map = rows.reduce((map, row) => {
    map[row.document_id] = row.title
    return map
  }, {})
  return map
}

async function getProjectViews(projectId, matrixMap, folioMap) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT hit_type, row_id, count(*) as count
      FROM stats_pub_hit_log
      WHERE project_id = ?
      GROUP BY hit_type, row_id
      ORDER BY hit_type, row_id`,
    { replacements: [projectId] }
  )
  let total = 0
  let views = {}
  let details = {}
  for (let i = 0; i < rows.length; i++) {
    const type = rows[i]['hit_type']
    const val = rows[i]['count']
    if (!views[type]) {
      views[type] = 0
    }
    views[type] += val
    total += val
    // get view details for specific view types
    const typeWithDetails = ['X', 'M', 'F']
    if (typeWithDetails.includes(type)) {
      const rowId = rows[i]['row_id']
      let name = ''
      switch (type) {
        case 'X':
          name = rowId ? matrixMap[rowId] : 'Matrix landing page'
          break
        case 'M':
          name = rowId ? 'M' + rowId : 'Media search'
          break
        case 'F':
          name = rowId ? folioMap[rowId] : 'Folio list'
      }
      if (!details[type]) {
        details[type] = []
      }
      details[type].push({ name, val })
    }
  }
  views['total'] = total
  views['details'] = details

  return views
}

async function getProjectDownloads(projectId, matrixMap, documentMap) {
  let [rows] = await sequelizeConn.query(
    `
      SELECT download_type, row_id, count(*) as count
      FROM stats_pub_download_log
      WHERE project_id = ?
      GROUP BY download_type, row_id
      ORDER BY download_type, row_id`,
    { replacements: [projectId] }
  )

  let total = 0
  let views = {}
  let details = {}
  for (let i = 0; i < rows.length; i++) {
    const type = rows[i]['download_type']
    const val = rows[i]['count']
    if (!views[type]) {
      views[type] = 0
    }
    views[type] += val
    total += val
    // get view details for specific view types
    const typeWithDetails = ['X', 'M', 'D']
    if (typeWithDetails.includes(type)) {
      const rowId = rows[i]['row_id']
      let name = ''
      switch (type) {
        case 'X':
          name = matrixMap[rowId]
          break
        case 'M':
          name = 'M' + rowId
          break
        case 'D':
          name = documentMap[rowId]
      }
      if (!details[type]) {
        details[type] = []
      }
      details[type].push({ name, val })
    }
  }
  views['total'] = total
  views['details'] = details

  return views
}

async function getProjectOverview(projectId, matrixMap, folioMap, documentMap) {
  const summary = await getProjectSummary(projectId)
  const matrices = await matrixService.getMatrices(projectId)
  const taxas = await taxaService.buildTaxa(projectId, matrices)
  const prj_stats = await statsService.getProjectStats(projectId)
  const image_props = await mediaService.getImageProps(projectId, 'small')
  const insts = await institutionService.fetchInstitutions(projectId)
  const project_views = await getProjectViews(projectId, matrixMap, folioMap)
  const project_downloads = await getProjectDownloads(
    projectId,
    matrixMap,
    documentMap
  )
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

async function getProjectDetails(projectId, matrixMap, folioMap, documentMap) {
  try {
    const overview = await getProjectOverview(
      projectId,
      matrixMap,
      folioMap,
      documentMap
    )
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

export { getProjectDetails, getMatrixMap, getFolioMap, getDocumentMap }
