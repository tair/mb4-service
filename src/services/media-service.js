import sequelizeConn from '../util/db.js'
import { capitalizeFirstLetter } from '../util/util.js'

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

export async function getMediaByCharacterIds(characterIds) {
  const [rows] = await sequelizeConn.query(
    `SELECT media_id
     FROM characters_x_media 
     WHERE character_id IN (?)`,
    { replacements: [characterIds] }
  )
  return rows
}
export async function getMediaByTaxaIds(taxaIds) {
  const [rows] = await sequelizeConn.query(
    `SELECT media_id
     FROM taxa_x_media 
     WHERE taxon_id IN (?)`,
    { replacements: [taxaIds] }
  )
  return rows
}

export async function getMediaFiles(projectId) {
  const [rows] = await sequelizeConn.query(
    `SELECT * FROM media_files WHERE project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
}

export async function getMediaLabels(mediaIds) {
  const [rows] = await sequelizeConn.query(
    `SELECT label_id FROM media_labels WHERE media_id IN (?)`,
    { replacements: [mediaIds] }
  )
  return rows
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

export async function getImageProps(projectId, type, exemplarMediaId) {
  // From the current observation, all published project does have a exemplarMediaId
  const [rows] = exemplarMediaId
    ? await sequelizeConn.query(
        `
              SELECT
                m.media, t.*, s.reference_source, s.institution_code,
                s.collection_code, s.catalog_number, v.name as view_name
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
              m.media, t.*, s.reference_source, s.institution_code,
              s.collection_code, s.catalog_number, v.name as view_name
            FROM media_files m
            LEFT JOIN media_views v on m.view_id = v.view_id
            LEFT JOIN specimens s ON m.specimen_id = s.specimen_id
            LEFT JOIN taxa_x_specimens ts ON s.specimen_id = ts.specimen_id
            LEFT JOIN taxa t ON t.taxon_id = ts.taxon_id
            WHERE m.project_id = ? AND m.media <> '' AND m.published = 0
            ORDER BY m.media_id
            LIMIT 1`,
        { replacements: [projectId] }
      )

  try {
    if (rows && rows.length) {
      let obj = { media: rows[0].media[type] }
      let specimenName = getSpecimenName(rows[0])
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
    console.log('getImageProp: ' + rows[0].media)
  }
}

function getSpecimenName(row) {
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
  // set author label
  if (row['scientific_name_author']) {
    let authorLabel = row['scientific_name_author'].trim()
    if (row['scientific_name_year']) {
      authorLabel += ', ' + row['scientific_name_year']
    }
    if (row['use_parens_for_author']) {
      authorLabel = '(' + authorLabel + ')'
    }
    name += ' ' + authorLabel
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
    name += ' (' + sourceLabel + ')'
  }
  return name
}
