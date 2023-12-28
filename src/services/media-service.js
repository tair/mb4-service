import sequelizeConn from '../util/db.js'

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

export async function getMediaFiles(projectId) {
  const [rows] = await sequelizeConn.query(
    "SELECT * FROM media_files WHERE project_id = ? AND media != ''",
    { replacements: [projectId] }
  )

  for (let i = 0; i < rows.length; i++) {
    let mediaObj = rows[i]
    if (mediaObj.media) {
      const { medium, thumbnail } = mediaObj.media
      mediaObj.media = { medium, thumbnail }
      rows[i] = mediaObj
    }
  }

  return rows
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

function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
