import sequelizeConn from '../util/db.js'
import { Multimap } from '../util/multimap.js'

export async function getProjectStats(projectId) {
  const [rows] = await sequelizeConn.query(
    'SELECT * FROM stats_projects_overview WHERE project_id = ?',
    { replacements: [projectId] }
  )
  return rows.length ? rows[0] : []
}

export async function getTaxaStats(projectId) {
  const [taxa] = await sequelizeConn.query(
    `
    SELECT
      matrix_id, taxon_id, taxon_number, taxon_name, unscored_cells,
      scored_cells, npa_cells, not_cells, cell_warnings, cell_images,
      cell_image_labels, cells_scored_no_npa_cnotes_cmedia_ccitations,
      last_modified_on
    FROM stats_taxa_overview
    WHERE project_id = ?
    ORDER BY matrix_id, taxon_number`,
    { replacements: [projectId] }
  )

  const [taxaUsers] = await sequelizeConn.query(
    `SELECT mto.matrix_id, mto.taxon_id, wu.fname, wu.lname
    FROM projects_x_users AS pxu
    LEFT JOIN project_members_x_groups AS pmxg
      ON pmxg.membership_id = pxu.link_id
    INNER JOIN matrix_taxa_order AS mto
      ON
        mto.group_id = pmxg.group_id OR 
        mto.user_id IS NULL OR 
        mto.group_id IS NULL
    INNER JOIN stats_taxa_overview AS sto
      ON
        sto.project_id = pxu.project_id AND
        sto.matrix_id = mto.matrix_id AND
        sto.taxon_id = mto.taxon_id
    INNER JOIN ca_users AS wu ON pxu.user_id = wu.user_id
    WHERE pxu.project_id = ?
    ORDER BY mto.matrix_id, mto.taxon_id, wu.lname, wu.fname`,
    { replacements: [projectId] }
  )

  const taxaUsersMap = new Multimap()
  for (const user of taxaUsers) {
    const key = user.matrix_id + '/' + user.taxon_id
    taxaUsersMap.put(key, `${user.fname} ${user.lname}`)
  }

  const taxaStatsMap = new Map()
  for (const taxon of taxa) {
    if (!taxaStatsMap.has(taxon.matrix_id)) {
      taxaStatsMap.set(taxon.matrix_id, {
        matrix_id: taxon.matrix_id,
        taxonStats: [],
      })
    }
    const key = taxon.matrix_id + '/' + taxon.taxon_id
    const members = taxaUsersMap.get(key)
    taxaStatsMap.get(taxon.matrix_id).taxonStats.push({
      ...taxon,
      members: members ? Array.from(members) : [],
    })
  }
  return Array.from(taxaStatsMap.values())
}

export async function getMembersStats(projectId) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT smo.*
    FROM stats_members_overview smo
    LEFT JOIN projects_x_users AS pxu
      ON
        smo.project_id = pxu.project_id AND
        smo.user_id = pxu.user_id
    WHERE
      smo.project_id = ?  AND
      fname != '' AND
      lname != ''
    ORDER BY administrator DESC, lname, fname`,
    { replacements: [projectId] }
  )
  return rows
}

export async function getRecentChangesStats(projectId, userId) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT
      temporal_type, taxa, specimens, media, characters, character_comments,
      character_notes, character_media, character_media_labels, cell_scorings,
      cell_comments, cell_notes, rules, documents, citations
    FROM stats_user_overview
    WHERE
      project_id = ? AND
      user_id = ?
    ORDER BY temporal_type`,
    { replacements: [projectId, userId] }
  )
  return rows
}
