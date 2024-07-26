import sequelizeConn from '../util/db.js'
import { capitalizeFirstLetter } from '../util/util.js'
import MediaFile from '../models/media-file.js'
import User from '../models/user.js'
import BibliographicReference from '../models/bibliographic-reference.js'

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
    `SELECT * FROM media_files WHERE project_id = ?`,
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
  return rows.map((r) => r.eol_id)
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
            s.collection_code, s.catalog_number, v.name as view_name
          FROM media_files m
          LEFT JOIN media_views v on m.view_id = v.view_id
          LEFT JOIN specimens s ON m.specimen_id = s.specimen_id
          WHERE
            m.project_id = ? AND m.published = 0 AND m.media_id = ?
        `,
        { replacements: [projectId, exemplarMediaId] }
      )
    : await sequelizeConn.query(
        `
          SELECT
            m.media_id, m.media, s.specimen_id, s.reference_source, s.institution_code,
            s.collection_code, s.catalog_number, v.name as view_name
          FROM media_files m
          LEFT JOIN media_views v on m.view_id = v.view_id
          LEFT JOIN specimens s ON m.specimen_id = s.specimen_id
          WHERE m.project_id = ? AND m.media <> '' AND m.published = 0
          ORDER BY m.media_id
          LIMIT 1
        `,
        { replacements: [projectId] }
      )

  try {
    if (rows && rows.length) {
      let obj = { media: rows[0].media[type] }
      let taxaNames = await getTaxaNames(projectId, rows[0].media_id)
      let specimenName = getSpecimenName(rows[0], taxaNames)
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
  const [rows] = await sequelizeConn.query(
    `
      SELECT m.media_id, m.media, s.specimen_id, s.description, s.reference_source,
      s.institution_code, s.collection_code, s.catalog_number, v.name as view_name, 
      m.is_sided, m.is_copyrighted, m.copyright_info, m.copyright_permission, m.copyright_license,
      u.fname, u.lname, p.publish_media_notes, m.notes, m.url, m.url_description, m.created_on,
      am.media_id as ancestor_media_id, ap.project_id as ancestor_project_id, ap.deleted as ancestor_project_deleted
      FROM media_files m
      INNER JOIN projects p ON m.project_id = p.project_id
      LEFT JOIN media_views v on m.view_id = v.view_id
      LEFT JOIN specimens s ON m.specimen_id = s.specimen_id
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

  const taxaMap = await getTaxaMap(projectId)
  const bibRefMap = await getBibliographicReferencesMap(projectId)
  const siblingMediaMap = await getSiblingMediaMap(projectId)
  const hitMap = await getPublishedHitsMap(projectId)
  const downloadMap = await getPublishedDownloadsMap(projectId)

  for (let i = 0; i < rows.length; i++) {
    let mediaObj = rows[i]
    const { medium, thumbnail } = mediaObj.media
    let obj = {
      media_id: mediaObj.media_id,
      media: { medium, thumbnail },
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
      mediaObj.copyright_info,
      mediaObj.copyright_permission
    )
    let taxaNames = taxaMap[mediaObj.media_id]
    if (taxaNames) {
      obj['taxa_name'] = taxaNames.join(' ')
    }
    let specimenName = getSpecimenName(mediaObj, taxaNames)
    if (specimenName) {
      obj['specimen_name'] = specimenName
    }
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

async function getTaxaMap(projectId) {
  const [taxaList] = await sequelizeConn.query(
    `
      SELECT m.media_id, t.*
      FROM media_files m
      INNER JOIN projects p ON m.project_id = p.project_id
      INNER JOIN specimens s ON m.specimen_id = s.specimen_id
      INNER JOIN taxa_x_specimens ts ON s.specimen_id = ts.specimen_id
      INNER JOIN taxa t ON t.taxon_id = ts.taxon_id
      WHERE m.project_id = ?
      AND m.published = 0
      AND m.media <> ''
      AND (p.publish_matrix_media_only = 0 OR (p.publish_matrix_media_only = 1 AND m.in_use_in_matrix = 1))
    `,
    { replacements: [projectId] }
  )
  let taxaMap = {}
  for (let i = 0; i < taxaList.length; i++) {
    let taxa = taxaList[i]
    if (!taxaMap[taxa.media_id]) {
      taxaMap[taxa.media_id] = []
    }
    taxaMap[taxa.media_id].push(getTaxaName(taxa))
  }
  return taxaMap
}

async function getTaxaNames(projectId, mediaId) {
  const [taxaNames] = await sequelizeConn.query(
    `
      SELECT t.*
      FROM media_files m
      INNER JOIN projects p ON m.project_id = p.project_id
      INNER JOIN specimens s ON m.specimen_id = s.specimen_id
      INNER JOIN taxa_x_specimens ts ON s.specimen_id = ts.specimen_id
      INNER JOIN taxa t ON t.taxon_id = ts.taxon_id
      WHERE m.project_id = ? AND m.media_id = ?
      AND m.published = 0
      AND m.media <> ''
      AND (p.publish_matrix_media_only = 0 OR (p.publish_matrix_media_only = 1 AND m.in_use_in_matrix = 1))
    `,
    { replacements: [projectId, mediaId] }
  )
  return taxaNames
}

function getTaxaName(row) {
  if (!row) return null
  // the rule is that we will take the genus + subgenus + specific_epithet + subspecific_epithet combo if exists,
  // and otherwise take the last field in the array order that has value
  const fields = [
    'supraspecific_clade',
    'higher_taxon_kingdom',
    'higher_taxon_phylum',
    'higher_taxon_class',
    'higher_taxon_subclass',
    'higher_taxon_infraclass',
    'higher_taxon_cohort',
    'higher_taxon_superorder',
    'higher_taxon_order',
    'higher_taxon_suborder',
    'higher_taxon_infraorder',
    'higher_taxon_superfamily',
    'higher_taxon_family',
    'higher_taxon_subfamily',
    'higher_taxon_tribe',
    'higher_taxon_subtribe',
    'genus',
    'subgenus',
    'specific_epithet',
    'subspecific_epithet',
  ]
  let lastNameFound
  let nameList = []
  let findOtu = false
  for (const field of fields) {
    let val = row[field]
    if (val) {
      val = val.trim()
      lastNameFound = val
    }
    if (field == 'genus') {
      findOtu = true
    }
    if (findOtu && val) {
      switch (field) {
        case 'genus':
          val = '<i>' + capitalizeFirstLetter(val) + '</i>'
          break
        case 'specific_epithet':
          val = '<i>' + val.toLowerCase() + '</i>'
          break
      }
      nameList.push(val)
    }
  }
  if (nameList.length == 0) {
    nameList = [lastNameFound]
  }
  let name = nameList.join(' ')
  if (row.is_extinct) {
    name = '† ' + name
  }
  return name
}

function getSpecimenName(row, taxaNames) {
  let name
  if (taxaNames) {
    name = taxaNames.join(', ')
  }
  // set author label
  if (row['scientific_name_author']) {
    let authorLabel = row['scientific_name_author'].trim()
    if (row['scientific_name_year']) {
      authorLabel += ', ' + row['scientific_name_year']
    }
    if (row['use_parens_for_author']) {
      authorLabel = '(' + authorLabel + ')'
    }
    if (name) {
      name += ' ' + authorLabel
    } else {
      name = authorLabel
    }
  }
  // set source label
  let sourceLabel
  if (row.reference_source) {
    sourceLabel = 'unvouchered'
  } else if (row.institution_code) {
    // institution code must exist when other two columns exist
    sourceLabel = row.institution_code
    if (row.collection_code) {
      sourceLabel += '/' + row.collection_code
    }
    if (row.catalog_number) {
      sourceLabel += ':' + row.catalog_number
    }
  }
  if (sourceLabel) {
    if (name) {
      name += ' (' + sourceLabel + ')'
    } else {
      name = sourceLabel
    }
  }
  return name
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
