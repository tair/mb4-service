import sequelizeConn from '../util/db.js'
import MediaFile from '../models/media-file.js'
import User from '../models/user.js'
import BibliographicReference from '../models/bibliographic-reference.js'
import {
  getTaxonNameForPublishedProject,
  getMediaTaxaSortFieldValues,
} from '../util/taxa.js'
import { getSpecimenNameForPublishedProject } from '../util/specimen.js'

export async function getMediaByIds(mediaIds) {
  const [media] = await sequelizeConn.query(
    `
    SELECT project_id, media_id, media
    FROM media_files
    WHERE media_id IN (?)`,
    {
      replacements: [mediaIds],
    }
  )
  return media
}

export async function getMediaFiles(projectId) {
  const [rows] = await sequelizeConn.query(
    `SELECT 
      mf.*,
      mv.name AS view_name,
      s.institution_code,
      s.collection_code,
      s.catalog_number,
      s.reference_source,
      t.genus,
      t.specific_epithet,
      t.subspecific_epithet,
      t.scientific_name_author,
      t.scientific_name_year,
      t.is_extinct
    FROM media_files mf
    LEFT JOIN media_views mv ON mf.view_id = mv.view_id
    LEFT JOIN specimens s ON mf.specimen_id = s.specimen_id
    LEFT JOIN taxa_x_specimens ts ON s.specimen_id = ts.specimen_id
    LEFT JOIN taxa t ON t.taxon_id = ts.taxon_id
    WHERE mf.project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
}

export async function getMediaSpecimensAndViews(projectId, partitionId) {
  // query all attrached to cells, taxa, characters
  // result = {specimen_count: number, view_count: number, onetime_media: number[], media_ids: number[] }
  const [[result]] = await sequelizeConn.query(
    `
      SELECT 
        COUNT(DISTINCT media.specimen_id) AS specimen_count,
        COUNT(DISTINCT media.view_id) AS view_count,
        GROUP_CONCAT(DISTINCT CASE WHEN media.copyright_license = 8 THEN media.media_id END) AS onetime_media,
        GROUP_CONCAT(DISTINCT media.media_id) AS media_ids
      FROM (
        SELECT mf.specimen_id, mf.view_id, mf.media_id, mf.copyright_license
        FROM media_files mf
        INNER JOIN cells_x_media cxm ON cxm.media_id = mf.media_id
        INNER JOIN taxa_x_partitions txp ON cxm.taxon_id = txp.taxon_id
        INNER JOIN characters_x_partitions cxp ON cxm.character_id = cxp.character_id
        WHERE mf.project_id = :projectId AND txp.partition_id = :partitionId AND cxp.partition_id = :partitionId
        UNION
        SELECT mf.specimen_id, mf.view_id, mf.media_id, mf.copyright_license
        FROM media_files mf
        INNER JOIN taxa_x_media txm ON txm.media_id = mf.media_id
        INNER JOIN taxa_x_partitions txp ON txm.taxon_id = txp.taxon_id
        WHERE mf.project_id = :projectId AND txp.partition_id = :partitionId
        UNION
        SELECT mf.specimen_id, mf.view_id, mf.media_id, mf.copyright_license
        FROM media_files mf
        INNER JOIN characters_x_media cxm ON cxm.media_id = mf.media_id
        INNER JOIN characters_x_partitions cxp ON cxm.character_id = cxp.character_id
        WHERE mf.project_id = :projectId AND cxp.partition_id = :partitionId
      ) AS media`,
    { replacements: { projectId: projectId, partitionId: partitionId } }
  )

  const specimenCount = result.specimen_count
  const viewCount = result.view_count

  // Ids are required for other features
  const onetimeMedia = result.onetime_media
    ? result.onetime_media.split(',')
    : []
  const medias = result.media_ids ? result.media_ids.split(',') : []

  return { medias, viewCount, specimenCount, onetimeMedia }
}

export async function getOneTimeMediaFiles(projectId) {
  const [rows] = await sequelizeConn.query(
    `SELECT media_id FROM media_files WHERE project_id = ? AND is_copyrighted > 0 AND copyright_license = 8`,
    { replacements: [projectId] }
  )
  return rows
}

export async function isMediaInProject(mediaIds, projectId) {
  const [[{ count }]] = await sequelizeConn.query(
    `
    SELECT COUNT(media_id) AS count
    FROM media_files
    WHERE project_id = ? AND media_id IN (?)`,
    {
      replacements: [projectId, mediaIds],
    }
  )
  return count == mediaIds.length
}

export async function getEolIds(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT DISTINCT eol_id
      FROM media_files
      WHERE project_id = ? AND eol_id IS NOT NULL`,
    { replacements: [projectId] }
  )
  return rows.map((r) => r.eol_id)
}

export async function getUUIDs(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT DISTINCT uuid
      FROM media_files
      WHERE project_id = ? AND uuid IS NOT NULL`,
    { replacements: [projectId] }
  )
  return rows.map((r) => r.uuid)
}

export async function getCitations(projectId, mediaIds) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT
      mxbr.link_id, mxbr.reference_id, mxbr.media_id, mxbr.pp, mxbr.notes,
      mxbr.user_id
    FROM media_files_x_bibliographic_references AS mxbr
    INNER JOIN media_files AS m ON m.media_id = mxbr.media_id
    WHERE m.project_id = ? AND m.media_id = ?`,
    { replacements: [projectId, mediaIds] }
  )
  return rows
}

export async function isCitationInProject(projectId, mediaId, citationIds) {
  const [[{ count }]] = await sequelizeConn.query(
    `
    SELECT COUNT(*) AS count
    FROM media_files_x_bibliographic_references AS mxbr
    INNER JOIN media_files AS m ON m.media_id = mxbr.media_id
    WHERE m.project_id = ? AND m.media_id = ? AND mxbr.link_id IN (?)`,
    {
      replacements: [projectId, mediaId, citationIds],
    }
  )
  return count == citationIds.length
}

export async function getCellMedia(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT DISTINCT cm.media_id
      FROM cells_x_media cm
      INNER JOIN media_files AS m ON m.media_id = cm.media_id
      WHERE m.project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
}

export async function getCharacterMedia(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT DISTINCT cm.media_id
      FROM characters_x_media cm
      INNER JOIN media_files AS m ON m.media_id = cm.media_id
      WHERE m.project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
}

export async function getTaxonMedia(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT DISTINCT tm.media_id
      FROM taxa_x_media tm
      INNER JOIN media_files AS m ON m.media_id = tm.media_id
      WHERE m.project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
}

export async function getDocumentMedia(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT DISTINCT dm.media_id
      FROM media_files_x_documents dm
      INNER JOIN media_files AS m ON m.media_id = dm.media_id
      WHERE m.project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
}

export async function getImageProps(projectId, type, exemplarMediaId) {
  // From the current observation, all published project does have a exemplarMediaId
  const [rows] = exemplarMediaId
    ? await sequelizeConn.query(
        `
          SELECT
            m.media_id, m.media, s.specimen_id, s.reference_source, s.institution_code,
            s.collection_code, s.catalog_number, v.name as view_name, t.*
          FROM media_files m
          LEFT JOIN media_views v on m.view_id = v.view_id
          LEFT JOIN specimens s ON m.specimen_id = s.specimen_id
          LEFT JOIN taxa_x_specimens ts ON s.specimen_id = ts.specimen_id
          LEFT JOIN taxa t ON t.taxon_id = ts.taxon_id
          WHERE
            m.project_id = ? AND m.published = 0 AND m.media_id = ?
        `,
        { replacements: [projectId, exemplarMediaId] }
      )
    : await sequelizeConn.query(
        `
          SELECT
            m.media_id, m.media, s.specimen_id, s.reference_source, s.institution_code,
            s.collection_code, s.catalog_number, v.name as view_name, t.*
          FROM media_files m
          LEFT JOIN media_views v on m.view_id = v.view_id
          LEFT JOIN specimens s ON m.specimen_id = s.specimen_id
          LEFT JOIN taxa_x_specimens ts ON s.specimen_id = ts.specimen_id
          LEFT JOIN taxa t ON t.taxon_id = ts.taxon_id
          WHERE m.project_id = ? AND m.media <> '' AND m.published = 0
          ORDER BY m.media_id
          LIMIT 1
        `,
        { replacements: [projectId] }
      )

  try {
    if (rows && rows.length) {
      let obj = { media: rows[0].media[type] }
      // Include media_id so frontend can use it directly
      if (rows[0].media_id) {
        obj['media_id'] = rows[0].media_id
      }
      let specimenName = getSpecimenNameForPublishedProject(rows[0])
      if (specimenName) {
        obj['specimen_name'] = specimenName
      }
      if (rows[0].view_name) {
        obj['view_name'] = rows[0].view_name.trim()
      }
      return obj
    }
    return {}
  } catch (e) {
    console.log('getImageProp error: ')
    console.log(e)
  }
}

export async function getMediaFileDump(projectId) {
  // Copyright license descriptions mapping
  const copyrightLicenseDescriptions = {
    0: "Media reuse policy not set",
    1: "CC0 - relinquish copyright",
    2: "Attribution CC BY - reuse with attribution",
    3: "Attribution-NonCommercial CC BY-NC - reuse but noncommercial",
    4: "Attribution-ShareAlike CC BY-SA - reuse here and applied to future uses",
    5: "Attribution- CC BY-NC-SA - reuse here and applied to future uses but noncommercial",
    6: "Attribution-NoDerivs CC BY-ND - reuse but no changes",
    7: "Attribution-NonCommercial-NoDerivs CC BY-NC-ND - reuse noncommerical no changes",
    8: "Media released for onetime use, no reuse without permission",
    20: "Unknown - Will set before project publication"
  };

  const [rows] = await sequelizeConn.query(
    `
      SELECT m.media_id, m.media, s.specimen_id, s.description, s.reference_source,
      s.institution_code, s.collection_code, s.catalog_number, t.*, v.name as view_name,
      m.is_sided, m.is_copyrighted, m.copyright_info, m.copyright_permission, m.copyright_license,
      u.fname, u.lname, p.publish_media_notes, m.notes, m.url, m.url_description, m.created_on,
      am.media_id as ancestor_media_id, ap.project_id as ancestor_project_id, ap.deleted as ancestor_project_deleted
      FROM media_files m
      INNER JOIN projects p ON m.project_id = p.project_id
      LEFT JOIN media_views v on m.view_id = v.view_id
      LEFT JOIN specimens s ON m.specimen_id = s.specimen_id
      LEFT JOIN taxa_x_specimens ts ON s.specimen_id = ts.specimen_id
      LEFT JOIN taxa t ON t.taxon_id = ts.taxon_id
      LEFT JOIN ca_users u ON m.user_id = u.user_id
      LEFT JOIN media_files am ON m.ancestor_media_id = am.media_id
      LEFT JOIN projects ap ON am.project_id = ap.project_id
      WHERE m.project_id = ?
      AND m.published = 0
      AND m.media <> ''
      AND (p.publish_matrix_media_only = 0 OR (p.publish_matrix_media_only = 1 AND m.in_use_in_matrix = 1))
    `,
    { replacements: [projectId] }
  )

  const bibRefMap = await getBibliographicReferencesMap(projectId)
  const siblingMediaMap = await getSiblingMediaMap(projectId)
  const hitMap = await getPublishedHitsMap(projectId)
  const downloadMap = await getPublishedDownloadsMap(projectId)

  for (let i = 0; i < rows.length; i++) {
    let mediaObj = rows[i]

    const { original, large, medium, thumbnail, ORIGINAL_FILENAME } =
      mediaObj.media
    let obj = {
      media_id: mediaObj.media_id,
      specimen_id: mediaObj.specimen_id,
      media: { original, large, medium, thumbnail, ORIGINAL_FILENAME },
    }
    let simpleTextFields = ['view_name', 'url', 'url_description']
    for (let textField of simpleTextFields) {
      if (mediaObj[textField]) {
        obj[textField] = mediaObj[textField].trim()
      }
    }
    obj['created_on'] = mediaObj['created_on']
    if (hitMap[mediaObj.media_id]) {
      obj['hits'] = hitMap[mediaObj.media_id]
    }
    if (downloadMap[mediaObj.media_id]) {
      obj['downloads'] = downloadMap[mediaObj.media_id]
    }
    obj['user_name'] = User.getName(mediaObj.fname, mediaObj.lname)
    obj['user_lname'] = mediaObj.lname

    if (mediaObj.is_copyrighted) {
      if (mediaObj.copyright_info) {
        obj['copyright_holder'] = mediaObj.copyright_info
      }
      obj['copyright_permission'] = MediaFile.getCopyrightPermission(
        mediaObj.copyright_permission
      )
    }
    obj['license'] = MediaFile.getLicenseImage(
      mediaObj.is_copyrighted,
      mediaObj.copyright_permission,
      mediaObj.copyright_license
    )
    
    // Add license description
    obj['license']['description'] = copyrightLicenseDescriptions[mediaObj.copyright_license] || copyrightLicenseDescriptions[0]
    obj['taxon_id'] = mediaObj.taxon_id
    obj['taxon_name'] = getTaxonNameForPublishedProject(mediaObj)
    // provided for js sorting & searching
    obj['taxon_sort_fields'] = getMediaTaxaSortFieldValues(mediaObj)
    // provided for js sorting & searching
    obj['specimen'] = {
      institution_code: mediaObj.institution_code,
      collection_code: mediaObj.collection_code,
      catalog_number: mediaObj.catalog_number,
    }
    obj['specimen_name'] = getSpecimenNameForPublishedProject(mediaObj)
    if (mediaObj.description) {
      obj['specimen_notes'] = mediaObj.description.trim()
    }
    if (mediaObj.is_sided) {
      obj['side_represented'] = MediaFile.getSideRepresentation(
        mediaObj.is_sided
      )
    }

    let referenceTexts = bibRefMap[mediaObj.media_id]
    if (referenceTexts) {
      obj['references'] = referenceTexts
    }

    if (mediaObj.publish_media_notes && mediaObj.notes) {
      obj['notes'] = mediaObj.notes.trim()
    }
    if (mediaObj.ancestor_media_id) {
      let ancestor = {
        media_id: mediaObj.ancestor_media_id,
        project_id: mediaObj.ancestor_project_id,
        project_deleted: mediaObj.ancestor_project_deleted,
      }
      let siblings = siblingMediaMap[mediaObj.media_id]
      if (siblings) {
        ancestor['child_siblings'] = siblings
      }
      obj['ancestor'] = ancestor
    }
    rows[i] = obj
  }
  return rows
}

async function getBibliographicReferencesMap(projectId) {
  const [references] = await sequelizeConn.query(
    `
      SELECT m.media_id, br.*
      FROM media_files m
      INNER JOIN projects p ON m.project_id = p.project_id
      INNER JOIN media_files_x_bibliographic_references AS txbr ON txbr.media_id = m.media_id
      INNER JOIN bibliographic_references br ON txbr.reference_id = br.reference_id 
      WHERE m.project_id = ?
      AND m.published = 0
      AND m.media <> ''
      AND (p.publish_matrix_media_only = 0 OR (p.publish_matrix_media_only = 1 AND m.in_use_in_matrix = 1))
    `,
    { replacements: [projectId] }
  )

  let referenceMap = {}
  for (let i = 0; i < references.length; i++) {
    let ref = references[i]
    if (!referenceMap[ref.media_id]) {
      referenceMap[ref.media_id] = []
    }
    referenceMap[ref.media_id].push(
      BibliographicReference.getCitationText(ref, null)
    )
  }
  return referenceMap
}

async function getSiblingMediaMap(projectId) {
  const [mediaFiles] = await sequelizeConn.query(
    `
      SELECT m.media_id, mf.media_id as sibling_media_id, mf.project_id as sibling_project_id
      FROM media_files m
      INNER JOIN projects p ON m.project_id = p.project_id
      INNER JOIN media_files mf ON m.ancestor_media_id = mf.ancestor_media_id AND m.project_id != mf.project_id
      INNER JOIN projects AS sp ON sp.project_id = mf.project_id
      WHERE m.project_id = ?
      AND m.published = 0
      AND m.media <> ''
      AND (p.publish_matrix_media_only = 0 OR (p.publish_matrix_media_only = 1 AND m.in_use_in_matrix = 1))
      AND sp.deleted = 0
    `,
    { replacements: [projectId] }
  )
  let siblingMediaMap = {}
  for (let i = 0; i < mediaFiles.length; i++) {
    let media = mediaFiles[i]
    if (!siblingMediaMap[media.media_id]) {
      siblingMediaMap[media.media_id] = []
    }
    siblingMediaMap[media.media_id].push({
      media_id: media.sibling_media_id,
      project_id: media.sibling_project_id,
    })
  }
  return siblingMediaMap
}

async function getPublishedHitsMap(projectId) {
  const [hits] = await sequelizeConn.query(
    `
      SELECT row_id, count(*) as count
      FROM media_files m
      INNER JOIN projects p ON m.project_id = p.project_id
      INNER JOIN stats_pub_hit_log h ON h.row_id = m.media_id AND h.project_id = p.project_id
      WHERE m.project_id = ?
      AND m.published = 0
      AND m.media <> ''
      AND (p.publish_matrix_media_only = 0 OR (p.publish_matrix_media_only = 1 AND m.in_use_in_matrix = 1))
      AND h.hit_type = 'M'
      GROUP BY h.project_id, h.row_id
    `,
    { replacements: [projectId] }
  )
  let hitMap = {}
  for (let i = 0; i < hits.length; i++) {
    let hit = hits[i]
    hitMap[hit.row_id] = hit.count
  }
  return hitMap
}

async function getPublishedDownloadsMap(projectId) {
  const [downloads] = await sequelizeConn.query(
    `
      SELECT row_id, count(*) as count
      FROM media_files m
      INNER JOIN projects p ON m.project_id = p.project_id
      INNER JOIN stats_pub_download_log d ON d.row_id = m.media_id AND d.project_id = p.project_id
      WHERE m.project_id = ?
      AND m.published = 0
      AND m.media <> ''
      AND (p.publish_matrix_media_only = 0 OR (p.publish_matrix_media_only = 1 AND m.in_use_in_matrix = 1))
      AND d.download_type = 'M'
      GROUP BY d.project_id, d.row_id
    `,
    { replacements: [projectId] }
  )
  let downloadMap = {}
  for (let i = 0; i < downloads.length; i++) {
    let download = downloads[i]
    downloadMap[download.row_id] = download.count
  }
  return downloadMap
}

/**
 * Get media files that share the same specimen as the given media.
 * Used for bulk copyright apply feature.
 * 
 * @param {number} projectId - Project ID
 * @param {number} specimenId - Specimen ID to search for
 * @param {number} excludeMediaId - Media ID to exclude from results (the current media)
 * @returns {Promise<Array>} Array of media files with same specimen
 */
export async function getMediaBySpecimen(projectId, specimenId, excludeMediaId = null) {
  if (!specimenId) {
    return []
  }

  const query = `
    SELECT 
      mf.media_id, mf.specimen_id, mf.view_id, mf.media,
      mf.is_copyrighted, mf.copyright_permission, mf.copyright_license, mf.copyright_info,
      mv.name AS view_name,
      s.institution_code, s.collection_code, s.catalog_number, s.reference_source,
      t.genus, t.specific_epithet
    FROM media_files mf
    LEFT JOIN media_views mv ON mf.view_id = mv.view_id
    LEFT JOIN specimens s ON mf.specimen_id = s.specimen_id
    LEFT JOIN taxa_x_specimens ts ON s.specimen_id = ts.specimen_id
    LEFT JOIN taxa t ON t.taxon_id = ts.taxon_id
    WHERE mf.project_id = ? 
      AND mf.specimen_id = ?
      ${excludeMediaId ? 'AND mf.media_id != ?' : ''}
    ORDER BY mf.media_id
  `
  
  const replacements = excludeMediaId 
    ? [projectId, specimenId, excludeMediaId]
    : [projectId, specimenId]

  const [rows] = await sequelizeConn.query(query, { replacements })
  return rows
}

/**
 * Get media files that share bibliographic references with the given media.
 * Used for bulk copyright apply feature.
 * 
 * @param {number} projectId - Project ID
 * @param {number[]} referenceIds - Array of bibliographic reference IDs to search for
 * @param {number} excludeMediaId - Media ID to exclude from results (the current media)
 * @returns {Promise<Array>} Array of media files with same citations
 */
export async function getMediaByCitations(projectId, referenceIds, excludeMediaId = null) {
  if (!referenceIds || referenceIds.length === 0) {
    return []
  }

  const query = `
    SELECT DISTINCT
      mf.media_id, mf.specimen_id, mf.view_id, mf.media,
      mf.is_copyrighted, mf.copyright_permission, mf.copyright_license, mf.copyright_info,
      mv.name AS view_name,
      s.institution_code, s.collection_code, s.catalog_number, s.reference_source,
      t.genus, t.specific_epithet
    FROM media_files mf
    INNER JOIN media_files_x_bibliographic_references mxbr ON mf.media_id = mxbr.media_id
    LEFT JOIN media_views mv ON mf.view_id = mv.view_id
    LEFT JOIN specimens s ON mf.specimen_id = s.specimen_id
    LEFT JOIN taxa_x_specimens ts ON s.specimen_id = ts.specimen_id
    LEFT JOIN taxa t ON t.taxon_id = ts.taxon_id
    WHERE mf.project_id = ? 
      AND mxbr.reference_id IN (?)
      ${excludeMediaId ? 'AND mf.media_id != ?' : ''}
    ORDER BY mf.media_id
  `
  
  const replacements = excludeMediaId 
    ? [projectId, referenceIds, excludeMediaId]
    : [projectId, referenceIds]

  const [rows] = await sequelizeConn.query(query, { replacements })
  return rows
}

/**
 * Get the citation (bibliographic reference) IDs for a media file.
 * 
 * @param {number} mediaId - Media ID
 * @returns {Promise<number[]>} Array of reference IDs
 */
export async function getMediaCitationIds(mediaId) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT reference_id FROM media_files_x_bibliographic_references
    WHERE media_id = ?
    `,
    { replacements: [mediaId] }
  )
  return rows.map(r => r.reference_id)
}
