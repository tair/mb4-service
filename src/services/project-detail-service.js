import sequelizeConn from '../util/db.js'
import * as bibService from '../services/bibliography-service.js'
import * as docsService from '../services/document-service.js'
import * as institutionService from './institution-service.js'
import * as matrixService from './matrix-service.js'
import * as mediaService from './media-service.js'
import * as mediaViewService from '../services/media-view-service.js'
import * as partitionService from '../services/partition-service.js'
import * as projectService from './projects-service.js'
import * as projectStatsService from './project-stats-service.js'
import * as specimenService from '../services/specimen-service.js'
import * as statsService from './published-stats-service.js'
import * as taxaService from '../services/taxa-service.js'
import * as foliosService from '../services/folios-service.js'

export async function getMatrixMap() {
  const [rows] = await sequelizeConn.query(
    `select matrix_id, title from matrices`
  )
  const map = rows.reduce((map, row) => {
    map[row.matrix_id] = row.title
    return map
  }, {})
  return map
}

export async function getFolioMap() {
  const [rows] = await sequelizeConn.query(`select folio_id, name from folios`)
  const map = rows.reduce((map, row) => {
    map[row.folio_id] = row.name
    return map
  }, {})
  return map
}

export async function getDocumentMap() {
  const [rows] = await sequelizeConn.query(
    `select document_id, title from project_documents`
  )
  const map = rows.reduce((map, row) => {
    map[row.document_id] = row.title
    return map
  }, {})
  return map
}

export async function getProjectDetails(
  projectId,
  matrixMap,
  folioMap,
  documentMap
) {
  try {
    const overview = await getProjectOverview(
      projectId,
      matrixMap,
      folioMap,
      documentMap
    )
    const taxa_details = await taxaService.getTaxaDetails(projectId)
    const partitions = await partitionService.getPartitions(projectId)
    const bibliography = await bibService.getBibliographiesDetails(projectId)
    const docs = await docsService.getDocuments(projectId)
    const specimen_details = await specimenService.getSpecimenDetails(projectId)
    const unidentified_specimen_details =
      await specimenService.getUnidentifiedSpecimenDetails(projectId)
    const media_views = await mediaViewService.getMediaViews(projectId)
    const mediaViewNames = media_views.map((v) => v.name)
    const folios_details = await foliosService.getFolioDetails(projectId)

    const result = {
      overview: overview,
      media_views: mediaViewNames,
      specimen_details: specimen_details,
      docs: docs,
      bibliography: bibliography,
      partitions: partitions,
      taxa_details: taxa_details,
    }
    if (folios_details && folios_details.length > 0)
      result['folios'] = folios_details
    if (
      unidentified_specimen_details &&
      unidentified_specimen_details.length > 0
    )
      result['unidentified_specimen_details'] = unidentified_specimen_details
    return result
  } catch (err) {
    console.error(
      `Error while getting project details (service). `,
      err.message
    )
    return null
  }
}

// for published project detail dump
async function getProjectOverview(projectId, matrixMap, folioMap, documentMap) {
  const summary = await projectService.getProject(projectId)
  const matrices = await matrixService.getMatricesDetails(projectId)
  const projectStats = await projectStatsService.getProjectStats(projectId)
  const taxas = await projectStatsService.getTaxaStats(projectId)
  const members = await projectStatsService.getMembersStats(projectId)
  const image_props = await mediaService.getImageProps(
    projectId,
    'small',
    summary.exemplar_media_id
  )
  const insts = await institutionService.fetchInstitutions(projectId)
  const project_views = await getProjectViews(projectId, matrixMap, folioMap)
  const project_downloads = await getProjectDownloads(
    projectId,
    matrixMap,
    documentMap
  )

  const result = {
    members: members,
    project_downloads: project_downloads,
    project_views: project_views,
    matrices: matrices,
    institutions: insts,
    image_props: image_props,
    stats: projectStats,
    taxas: taxas,
    ...summary,
  }

  return result
}

export async function getProjectViews(projectId, matrixMap, folioMap) {
  const rows = await statsService.getProjectViews(projectId)
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
      details[type].push({ rowId, name, val })
    }
  }
  views['total'] = total
  views['details'] = details

  return views
}

export async function getProjectDownloads(projectId, matrixMap, documentMap) {
  const rows = await statsService.getProjectDownloads(projectId)
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
