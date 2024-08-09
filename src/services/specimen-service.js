import sequelizeConn from '../util/db.js'
import User from '../models/user.js'
import BibliographicReference from '../models/bibliographic-reference.js'
import { getSpecimenNameForPublishedProject } from '../util/specimen.js'
import {
  getSpecimenTaxonNameForPublishedProject,
  getSpecimenTaxaSortFieldValues,
} from '../util/taxa.js'

export async function getProjectSpecimens(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT s.*, ts.taxon_id
      FROM specimens AS s
      LEFT JOIN taxa_x_specimens AS ts ON s.specimen_id = ts.specimen_id
      WHERE s.project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
}

/**
 * Gets the vouchered specimen from a given project and set of taxa.
 *
 * This will return a map in which taxon IDs are the keys and the specimen IDs
 * are the values. The values are unique because we have constraints on the
 * number of vouchered taxon and specimen combination.
 */
export async function getVoucheredSpecimenIdByTaxaIds(projectId, taxaIds) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT txs.taxon_id, s.specimen_id
      FROM specimens s
      INNER JOIN taxa_x_specimens AS txs ON txs.specimen_id = s.specimen_id
      WHERE s.project_id = ? AND txs.taxon_id IN (?) AND s.reference_source = 1`,
    { replacements: [projectId, taxaIds] }
  )

  const map = new Map()
  for (const row of rows) {
    map.set(row.taxon_id, row.specimen_id)
  }
  return map
}

// for published project dumping
export async function getSpecimenDetails(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT s.specimen_id, s.reference_source, s.institution_code, s.description,
          s.collection_code, s.catalog_number, s.created_on, t.*, u.fname, u.lname
      FROM specimens s
      LEFT JOIN ca_users u ON u.user_id = s.user_id
      LEFT JOIN taxa_x_specimens ts ON s.specimen_id = ts.specimen_id
      LEFT JOIN taxa t ON t.taxon_id = ts.taxon_id
      WHERE s.project_id = ?`,
    { replacements: [projectId] }
  )
  const bibRefMap = await getBibliographicReferencesMap(projectId)
  const hitMap = await getPublishedHitsMap(projectId)
  // biblicoreferences
  return rows.map((r) => {
    const obj = {
      reference_source: getReferenceSourceText(r.reference_source),
      institution_code: r.institution_code,
      collection_code: r.collection_code,
      catalog_number: r.catalog_number,
      created_on: r.created_on,
      user_name: User.getName(r.fname, r.lname),
      specimen_name: getSpecimenNameForPublishedProject(r),
      taxon_name: getSpecimenTaxonNameForPublishedProject(r),
      sort_fields: getSpecimenTaxaSortFieldValues(r),
    }
    if (hitMap[r.specimen_id]) {
      obj['hits'] = r.specimen_id
    }
    if (r.description) {
      obj['specimen_notes'] = r.description.trim()
    }
    let referenceTexts = bibRefMap[r.specimen_id]
    if (referenceTexts) {
      obj['references'] = referenceTexts
    }
    return obj
  })
}

// for published project dumping
export async function getUnidentifiedSpecimenDetails(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT s.specimen_id, s.reference_source, s.institution_code, s.description,
          s.collection_code, s.catalog_number, s.created_on, u.fname, u.lname
      FROM specimens s
      LEFT JOIN ca_users u ON u.user_id = s.user_id
      LEFT JOIN taxa_x_specimens ts ON s.specimen_id = ts.specimen_id
      WHERE ts.specimen_id is null AND s.project_id = ?
      ORDER BY s.reference_source DESC, s.institution_code, s.collection_code, s.catalog_number;`,
    { replacements: [projectId] }
  )
  const bibRefMap = await getBibliographicReferencesMap(projectId)
  const hitMap = await getPublishedHitsMap(projectId)
  // biblicoreferences
  return rows.map((r) => {
    const obj = {
      reference_source: getReferenceSourceText(r.reference_source),
      institution_code: r.institution_code,
      collection_code: r.collection_code,
      catalog_number: r.catalog_number,
      created_on: r.created_on,
      user_name: User.getName(r.fname, r.lname),
      specimen_name: getSpecimenNameForPublishedProject(r),
    }
    if (hitMap[r.specimen_id]) {
      obj['hits'] = r.specimen_id
    }
    if (r.description) {
      obj['specimen_notes'] = r.description.trim()
    }
    let referenceTexts = bibRefMap[r.specimen_id]
    if (referenceTexts) {
      obj['references'] = referenceTexts
    }
    return obj
  })
}

function getReferenceSourceText(refSource) {
  return refSource ? 'Unvouchered' : 'Vouchered'
}

async function getBibliographicReferencesMap(projectId) {
  const [references] = await sequelizeConn.query(
    `
      SELECT s.specimen_id, br.*
      FROM specimens s
      INNER JOIN specimens_x_bibliographic_references AS sxbr ON sxbr.specimen_id = s.specimen_id
      INNER JOIN bibliographic_references br ON sxbr.reference_id = br.reference_id
      WHERE s.project_id = ?
    `,
    { replacements: [projectId] }
  )

  let referenceMap = {}
  for (let i = 0; i < references.length; i++) {
    let ref = references[i]
    if (!referenceMap[ref.specimen_id]) {
      referenceMap[ref.specimen_id] = []
    }
    referenceMap[ref.specimen_id].push(
      BibliographicReference.getCitationText(ref, null)
    )
  }
  return referenceMap
}

async function getPublishedHitsMap(projectId) {
  const [hits] = await sequelizeConn.query(
    `
      SELECT row_id, count(*) as count
      FROM specimens s
      INNER JOIN stats_pub_hit_log h ON h.row_id = s.specimen_id AND h.project_id = s.project_id
      WHERE s.project_id = ?
      AND h.hit_type = 'S'
      GROUP BY s.project_id, h.row_id
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

export async function isSpecimensInProject(specimenIds, projectId) {
  const [[{ count }]] = await sequelizeConn.query(
    `
    SELECT COUNT(specimen_id) AS count
    FROM specimens
    WHERE project_id = ? AND specimen_id IN (?)`,
    {
      replacements: [projectId, specimenIds],
    }
  )
  return count == specimenIds.length
}

export async function getVoucheredSpecimen(taxonId) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT s.specimen_id
    FROM specimen AS s
    INNER JOIN taxa_x_specimens AS txs ON s.specimen_id = txs.specimen_id
    WHERE s.reference_source = 1 AND t.taxon_id = ?`,
    { replacements: [taxonId] }
  )
  return rows.map((r) => r.specimen_id)
}

export async function getUnvoucheredSpecimen(
  taxonId,
  institutionCode,
  collectionCode,
  catalogNumber
) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT s.specimen_id
    FROM specimens s
    INNER JOIN taxa_x_specimens AS txs ON s.specimen_id = txs.specimen_id
    WHERE
      s.reference_source = 0 AND
      s.institution_code = ? AND
      s.collection_code = ?  AND
      s.catalog_number = ?`,
    { replacements: [taxonId, institutionCode, collectionCode, catalogNumber] }
  )
  return rows.map((r) => r.specimen_id)
}

export async function getSpecimenCitations(projectId, specimenId) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT
      sxbr.link_id, sxbr.reference_id, sxbr.specimen_id, sxbr.pp, sxbr.notes,
      sxbr.user_id
    FROM specimens_x_bibliographic_references AS sxbr
    INNER JOIN specimens AS s ON s.specimen_id = sxbr.specimen_id
    WHERE s.project_id = ? AND s.specimen_id = ?`,
    { replacements: [projectId, specimenId] }
  )
  return rows
}

export async function isSpecimenCitationsInProject(
  projectId,
  specimenId,
  citationIds
) {
  const [[{ count }]] = await sequelizeConn.query(
    `
    SELECT COUNT(*) AS count
    FROM specimens_x_bibliographic_references AS sxbr
    INNER JOIN specimens AS s ON s.specimen_id = sxbr.specimen_id
    WHERE s.project_id = ? AND s.specimen_id = ? AND sxbr.link_id IN (?)`,
    {
      replacements: [projectId, specimenId, citationIds],
    }
  )
  return count == citationIds.length
}
