import sequelizeConn from '../util/db.js'
import { getTaxonName } from '../util/taxa.js'
import { time } from '../util/util.js'

/**
 * This class is used to generate overview statistics for a specific project.
 * These statistics are placed in the project's overview page in order to
 * outline the number of items that are within the project as well as all the
 * members' contributions to them.
 *
 * The tables are assumed to be staled and not updated in realtime.
 */
export class ProjectOverviewGenerator {
  /**
   * Returns a set of projects that were updated in the past 30 mins. This is
   * meant to be done in a cron job whose frequency is less than 30 mins so
   * that we can get all projects that were modified recently.
   * @returns An array of projects.
   */
  async getOutdatedProjects() {
    const [projects] = await sequelizeConn.query(`
      SELECT
        project_id, user_id, published, 
        publish_matrix_media_only, publish_inactive_members
      FROM projects
      WHERE 
        published = 0 AND 
        deleted = 0 AND 
        last_accessed_on > UNIX_TIMESTAMP(NOW() - INTERVAL 30 MINUTE)`)
    return projects
  }

  generateStats(project) {
    return Promise.all([
      this.generateProjectStats(project),
      this.generateTaxonomyStats(project),
      this.generateMemberStats(project),
    ])
  }

  async generateProjectStats(project) {
    let publishedWhereClause = ''
    let matrixPublishedWhereClause = ''
    let mediaPublishedWhereClause = ''
    let matrixMediaWhereClause = ''
    let matrixJoinClause = ''
    let mediaJoinClause = ''
    if (project.published) {
      publishedWhereClause = 'published = 0 AND'
      mediaPublishedWhereClause = 'mf.published = 0 AND'
      matrixPublishedWhereClause = 'm.published = 0 AND'
      mediaJoinClause = 'INNER JOIN media_files AS mf USING(media_id)'
      matrixJoinClause = 'INNER JOIN matrices AS m USING(matrix_id)'
      if (project.publish_matrix_media_only) {
        matrixMediaWhereClause = 'mf.in_use_in_matrix = 1 AND'
      }
    }

    const projectId = parseInt(project.project_id)
    const transaction = await sequelizeConn.transaction()
    const query = async (sql) =>
      sequelizeConn.query(sql, {
        replacements: [projectId],
        transaction,
      })

    const getCount = async (sql) => {
      const [[{ count }]] = await query(sql)
      return count
    }

    const matrixCount = await getCount(`
      SELECT COUNT(*) AS count
      FROM matrices
      WHERE
        ${publishedWhereClause}
        project_id = ?`)

    const documentCount = await getCount(`
      SELECT COUNT(*) AS count
      FROM project_documents
      WHERE
        ${publishedWhereClause}
        project_id = ?`)

    const folioCount = await getCount(`
      SELECT COUNT(*) AS count
      FROM folios
      WHERE
        ${publishedWhereClause}
        project_id = ?`)

    const taxaCount = await getCount(`
      SELECT COUNT(*) AS count
      FROM taxa
      WHERE project_id = ?`)

    const specimenCount = await getCount(`
      SELECT COUNT(*) AS count
      FROM specimens
      WHERE project_id = ?`)

    const characterCount = await getCount(`
      SELECT COUNT(DISTINCT ch.character_id) AS count
      FROM characters AS ch 
      INNER JOIN matrix_character_order AS mco 
        ON mco.character_id = ch.character_id
      INNER JOIN matrices AS m
        ON m.matrix_id = mco.matrix_id
      WHERE m.project_id = ?`)

    const [mediaTypes] = await query(`
      SELECT mf.media_type, COUNT(*) AS count
      FROM media_files mf
      WHERE mf.project_id = ?
      GROUP BY mf.media_type`)
    const mediaTypesCounts = {}
    mediaTypes.forEach(
      (t) => (mediaTypesCounts[t.media_type] = parseInt(t.count))
    )
    const mediaCount = Object.values(mediaTypesCounts).reduce(
      (t, n) => t + n,
      0
    )

    const [[{ mediaSize }]] = await query(`
      SELECT SUM(media->>"$.original.PROPERTIES.filesize") AS mediaSize
      FROM media_files mf
      WHERE mf.project_id = ?`)

    const cellScoreCount = await getCount(`
      SELECT COUNT(*) AS count
      FROM cells c
      INNER JOIN matrices AS m ON m.matrix_id = c.matrix_id
      WHERE
        ${matrixPublishedWhereClause}
        project_id = ?`)

    const cellMediaCount = await getCount(`
      SELECT COUNT(*) AS count
      FROM cells_x_media cxm
      ${matrixJoinClause}
      INNER JOIN media_files AS mf ON mf.media_id = cxm.media_id
      WHERE
        ${matrixPublishedWhereClause}
        ${mediaPublishedWhereClause}
        ${matrixMediaWhereClause}
        mf.project_id = ?`)

    const cellMediaLabelCount = await getCount(`
      SELECT COUNT(*) AS count
      FROM cells_x_media cxm
      ${matrixJoinClause}
      INNER JOIN media_labels AS ml
        ON ml.link_id = cxm.link_id AND ml.table_num = 7
      INNER JOIN media_files AS mf
        ON mf.media_id = cxm.media_id
      WHERE
        ${matrixPublishedWhereClause}
        ${mediaPublishedWhereClause}
        ${matrixMediaWhereClause}
        mf.project_id = ?`)

    const allCharacterCount = await getCount(`
      SELECT COUNT(*) AS count
      FROM characters c
      INNER JOIN matrix_character_order AS mco
        ON mco.character_id = c.character_id
      INNER JOIN matrices AS m
        ON mco.matrix_id = m.matrix_id
      WHERE
        ${matrixPublishedWhereClause}
        m.project_id = ?`)

    const unorderedCharacterCount = await getCount(`
      SELECT COUNT(*) AS count
      FROM characters c
      INNER JOIN matrix_character_order AS mco
        ON mco.character_id = c.character_id
      INNER JOIN matrices AS m
        ON mco.matrix_id = m.matrix_id
      WHERE
        ${matrixPublishedWhereClause}
        c.ordering = 0 AND
        m.project_id = ?`)

    const characterMediaCount = await getCount(`
      SELECT COUNT(DISTINCT c.character_id) AS count
      FROM characters c
      INNER JOIN matrix_character_order AS mco
        ON mco.character_id = c.character_id
      INNER JOIN matrices AS m
        ON mco.matrix_id = m.matrix_id
      INNER JOIN characters_x_media AS cxm
        ON cxm.character_id = c.character_id
      ${mediaJoinClause}
      WHERE
        ${matrixPublishedWhereClause}
        ${mediaPublishedWhereClause}
        ${matrixMediaWhereClause}
        cxm.state_id IS NULL AND
        m.project_id = ?`)

    const characterMediaLabelCount = await getCount(`
      SELECT COUNT(DISTINCT c.character_id) AS count
      FROM characters c
      INNER JOIN matrix_character_order AS mco
        ON mco.character_id = c.character_id
      INNER JOIN matrices AS m
        ON mco.matrix_id = m.matrix_id
      INNER JOIN characters_x_media AS cxm
        ON cxm.character_id = c.character_id
      INNER JOIN media_files AS mf
        ON mf.media_id = cxm.media_id
      INNER JOIN media_labels AS ml
        ON mf.media_id = ml.media_id AND ml.table_num = 16
      WHERE
        ${matrixPublishedWhereClause}
        ${mediaPublishedWhereClause}
        ${matrixMediaWhereClause}
        cxm.state_id IS NULL AND
        m.project_id = ?`)

    const characterStatesCount = await getCount(`
      SELECT COUNT(DISTINCT cs.state_id) AS count
      FROM characters c
      INNER JOIN matrix_character_order AS mco
        ON mco.character_id = c.character_id
      INNER JOIN matrices AS m
        ON mco.matrix_id = m.matrix_id
      INNER JOIN character_states AS cs
        ON cs.character_id = c.character_id
      WHERE
        ${matrixPublishedWhereClause}
        m.project_id = ?`)

    const characterStateMediaCount = await getCount(`
      SELECT COUNT(DISTINCT cs.state_id) AS count
      FROM characters c
      INNER JOIN matrix_character_order AS mco
        ON mco.character_id = c.character_id
      INNER JOIN matrices AS m
        ON mco.matrix_id = m.matrix_id
      INNER JOIN character_states AS cs
        ON cs.character_id = c.character_id
      INNER JOIN characters_x_media AS cxm
        ON cxm.state_id = cs.state_id
      ${mediaJoinClause}
      WHERE
        ${matrixPublishedWhereClause}
        ${mediaPublishedWhereClause}
        ${matrixMediaWhereClause}
        m.project_id = ?`)

    const characterStateMediaLabelsCount = await getCount(`
      SELECT COUNT(DISTINCT cs.state_id) AS count
      FROM characters c
      INNER JOIN matrix_character_order AS mco
        ON mco.character_id = c.character_id
      INNER JOIN matrices AS m
        ON mco.matrix_id = m.matrix_id
      INNER JOIN character_states AS cs
        ON cs.character_id = c.character_id
      INNER JOIN characters_x_media AS cxm
        ON cxm.state_id = cs.state_id
      INNER JOIN media_files AS mf
        ON mf.media_id = cxm.media_id
      INNER JOIN media_labels as ml
        ON mf.media_id = ml.media_id AND ml.table_num = 16
      WHERE
        ${matrixPublishedWhereClause}
        ${mediaPublishedWhereClause}
        ${matrixMediaWhereClause}
        m.project_id = ?`)
    const stats = [
      projectId,
      mediaCount,
      mediaTypesCounts['audio'] || 0,
      mediaTypesCounts['video'] || 0,
      mediaTypesCounts['image'] || 0,
      mediaTypesCounts['3d'] || 0,
      matrixCount,
      documentCount,
      folioCount,
      taxaCount,
      specimenCount,
      characterCount,
      mediaSize,
      cellScoreCount,
      cellMediaCount,
      cellMediaLabelCount,
      allCharacterCount,
      unorderedCharacterCount,
      characterMediaCount,
      characterMediaLabelCount,
      characterStatesCount,
      characterStateMediaCount,
      characterStateMediaLabelsCount,
    ]

    await sequelizeConn.query(
      `
      REPLACE INTO stats_projects_overview (
        project_id, media, media_audio, media_video, media_image, media_3d,
        matrices, docs, folios, taxa, specimens, characters, media_size,
        matrix_cells_scored, matrix_cell_media, matrix_cell_media_labels,
        character_characters, character_unordered, character_media_characters,
        character_media_characters_labels, character_states,
        character_state_media, character_state_media_labels)
      VALUES (?)`,
      { replacements: [stats], transaction }
    )

    await transaction.commit()
    return stats
  }

  async generateTaxonomyStats(project) {
    const projectId = parseInt(project.project_id)
    const transaction = await sequelizeConn.transaction()

    const publishedWhereClause = project.published ? 'published = 0 AND' : ''
    const [matrices] = await sequelizeConn.query(
      `
      SELECT matrix_id
      FROM matrices
      WHERE
        ${publishedWhereClause}
        project_id = ?`,
      {
        replacements: [projectId],
        transaction,
      }
    )

    const entries = []
    const currentTime = time()
    for (const matrix of matrices) {
      const query = async (sql) =>
        sequelizeConn.query(sql, {
          replacements: [matrix.matrix_id],
          transaction,
        })
      const [[{ characterCount }]] = await query(`
        SELECT COUNT(*) AS characterCount
        FROM matrix_character_order
        WHERE matrix_id = ?`)

      const [taxaResults] = await query(`
        SELECT *
        FROM taxa t
        INNER JOIN matrix_taxa_order mto ON mto.taxon_id = t.taxon_id
        WHERE mto.matrix_id = ?
        ORDER BY mto.position`)

      const stats = new Map()
      for (const result of taxaResults) {
        stats.set(result.taxon_id, {
          name: getTaxonName(result),
          taxonNumber: result.position,
          lastModifiedOn: result.last_modified_on,
          scored: 0,
          unscored: characterCount,
          nonnpa: 0,
          npa: 0,
          inapplicable: 0,
          warnings: 0,
          images: 0,
          labels: 0,
          cells_scored_no_npa_cnotes_cmedia_ccitations: 0,
        })
      }

      const [cellScores] = await query(`
        SELECT c.taxon_id, COUNT(DISTINCT c.character_id) AS count
        FROM cells c
        INNER JOIN matrix_taxa_order AS mto
          ON mto.matrix_id = c.matrix_id AND mto.taxon_id = c.taxon_id
        WHERE c.matrix_id = ?
        GROUP BY c.taxon_id`)
      for (const result of cellScores) {
        stats.get(result.taxon_id).scored = result.count
        stats.get(result.taxon_id).unscored -= result.count
      }

      const [applicableScores] = await query(`
        SELECT c.taxon_id, COUNT(DISTINCT c.character_id) AS count
        FROM cells c
        INNER JOIN matrix_taxa_order AS mto
          ON mto.matrix_id = c.matrix_id AND mto.taxon_id = c.taxon_id
        WHERE
          c.is_npa = 0 AND
          c.state_id is NOT NULL AND
          c.matrix_id = ?
        GROUP BY c.taxon_id`)
      for (const result of applicableScores) {
        stats.get(result.taxon_id).nonnpa = result.count
      }

      const [npaScores] = await query(`
        SELECT c.taxon_id, COUNT(DISTINCT c.character_id) AS count
        FROM cells c
        INNER JOIN matrix_taxa_order AS mto
          ON mto.matrix_id = c.matrix_id AND mto.taxon_id = c.taxon_id
        WHERE
          c.is_npa = 1 AND
          c.matrix_id = ?
        GROUP BY c.taxon_id`)
      for (const result of npaScores) {
        stats.get(result.taxon_id).nonnpa = result.count
      }

      const [inapplicableScores] = await query(`
        SELECT c.taxon_id, COUNT(DISTINCT c.character_id) AS count
        FROM cells c
        INNER JOIN matrix_taxa_order AS mto
          ON mto.matrix_id = c.matrix_id AND mto.taxon_id = c.taxon_id
        WHERE
          c.is_npa = 0 AND
          c.state_id is NULL AND
          c.matrix_id = ?
        GROUP BY c.taxon_id`)
      for (const result of inapplicableScores) {
        stats.get(result.taxon_id).inapplicable = result.count
      }

      let mediaPublishedWhereClause = ''
      let matrixMediaWhereClause = ''
      if (project.published) {
        mediaPublishedWhereClause = 'mf.published = 0 OR'
        if (project.publish_matrix_media_only) {
          matrixMediaWhereClause = 'mf.in_use_in_matrix = 1 OR'
        }
      }
      const [undocumentedScores] = await query(`
        SELECT c.taxon_id, COUNT(DISTINCT c.character_id) AS count
        FROM cells c
        LEFT JOIN cells_x_media AS cxm
          ON cxm.taxon_id = c.taxon_id AND
            cxm.character_id = c.character_id AND
            cxm.matrix_id = c.matrix_id
        LEFT JOIN media_files AS mf 
          ON cxm.media_id = mf.media_id
        LEFT JOIN cell_notes AS cn
          ON cn.taxon_id = c.taxon_id AND
            cn.character_id = c.character_id AND
            cn.matrix_id = c.matrix_id
        LEFT JOIN cells_x_bibliographic_references AS cxbr
          ON cxbr.taxon_id = c.taxon_id AND
            cxbr.character_id = c.character_id AND
            cxbr.matrix_id = c.matrix_id
        WHERE
          (
            ${mediaPublishedWhereClause}
            ${matrixMediaWhereClause}
            cxm.link_id IS NULL) AND
          (cn.note_id OR cn.notes = '') AND
          cxbr.link_id IS NULL AND
          c.is_npa = 0 AND
          c.state_id IS NOT NULL AND
          c.matrix_id = ?
        GROUP BY c.taxon_id`)
      for (const result of undocumentedScores) {
        stats.get(result.taxon_id).undocumentedScores = result.count
      }

      const [warnings] = await query(`
        SELECT lcc.taxon_id, COUNT(DISTINCT ccl.character_id) AS count
        FROM cell_change_log AS lcc
        INNER JOIN matrix_taxa_order AS mto USING (matrix_id, taxon_id)
        INNER JOIN matrix_character_order AS mco USING (matrix_id, character_id)
        INNER JOIN character_change_log AS ccl USING(character_id)
        WHERE lcc.matrix_id = ?
        GROUP BY lcc.taxon_id
        HAVING MAX(lcc.changed_on) < MAX(ccl.changed_on)`)
      for (const result of warnings) {
        stats.get(result.taxon_id).warnings = result.count
      }

      let mediaJoinClause = ''
      if (project.published) {
        mediaJoinClause =
          'INNER JOIN media_files as mf ON cxm.media_id = mf.media_id'
        mediaPublishedWhereClause = 'mf.published = 0 AND'
        if (project.publish_matrix_media_only) {
          matrixMediaWhereClause = 'mf.in_use_in_matrix = 1 AND'
        }
      }

      const [images] = await query(`
        SELECT cxm.taxon_id, COUNT(*) AS count
        FROM cells_x_media cxm
        ${mediaJoinClause}
        WHERE
          ${mediaPublishedWhereClause}
          ${matrixMediaWhereClause}
          cxm.matrix_id = ?
        GROUP BY cxm.taxon_id`)
      for (const result of images) {
        stats.get(result.taxon_id).images = result.count
      }

      const [labels] = await query(`
        SELECT cxm.taxon_id, COUNT(*) AS count
        FROM cells_x_media cxm
        ${mediaJoinClause}
        INNER JOIN media_labels AS ml
          ON ml.link_id = cxm.link_id AND ml.media_id = cxm.media_id
        WHERE
          ${mediaPublishedWhereClause}
          ${matrixMediaWhereClause}
          cxm.matrix_id = ? AND ml.table_num = 7
        GROUP BY cxm.taxon_id`)
      for (const result of labels) {
        stats.get(result.taxon_id).labels = result.count
      }

      for (const [taxonId, stat] of stats.entries()) {
        entries.push([
          projectId,
          matrix.matrix_id,
          taxonId,
          stat.taxonNumber,
          stat.name,
          stat.unscored,
          stat.nonnpa,
          stat.npa,
          stat.inapplicable,
          stat.warnings,
          stat.images,
          stat.labels,
          stat.undocumentedScores,
          stat.lastModifiedOn,
          currentTime,
        ])
      }
    }

    await sequelizeConn.query(
      `DELETE FROM stats_taxa_overview WHERE project_id = ?`,
      { replacements: [projectId], transaction }
    )

    await sequelizeConn.query(
      `
      INSERT INTO stats_taxa_overview (
        project_id, matrix_id, taxon_id, taxon_number, taxon_name,
        unscored_cells, scored_cells, npa_cells, not_cells, cell_warnings,
        cell_images, cell_image_labels,
        cells_scored_no_npa_cnotes_cmedia_ccitations, last_modified_on,
        generated_on)
      VALUES ?`,
      { replacements: [entries], transaction }
    )

    await transaction.commit()
    return entries
  }

  async generateMemberStats(project) {
    let matrixPublishedWhereClause = ''
    let mediaPublishedWhereClause = ''
    let matrixMediaWhereClause = ''
    let matrixJoinClause = ''
    if (project.published) {
      mediaPublishedWhereClause = 'mf.published = 0 AND'
      matrixPublishedWhereClause = 'm.published = 0 AND'
      matrixJoinClause = 'INNER JOIN matrices AS m USING(matrix_id)'
      if (project.publish_matrix_media_only) {
        matrixMediaWhereClause = 'mf.in_use_in_matrix = 1 AND'
      }
    }

    const projectId = parseInt(project.project_id)
    const transaction = await sequelizeConn.transaction()
    const query = async (sql) =>
      sequelizeConn.query(sql, {
        replacements: [projectId],
        transaction,
      })

    const [members] = await query(`
      SELECT
        u.user_id, u.fname, u.lname, u.email, pu.last_accessed_on,
        pu.membership_type, u.active
      FROM ca_users u
      INNER JOIN projects_x_users AS pu ON u.user_id = pu.user_id
      WHERE pu.project_id = ?
      ORDER BY u.lname, u.fname`)
    const stats = new Map()
    for (const member of members) {
      const memberStat = {
        member_name: member.fname + ' ' + member.lname,
        email: member.email,
        fname: member.fname,
        lname: member.lname,
        is_administrator: member.user_id == project.user_id,
        last_accessed_on: member.last_accessed_on,
        member_role: member.membership_type,
        membership_status: member.active,
      }

      const userId = member.user_id
      stats.set(userId, Object.assign(memberStat, MEMBER_BASE_COUNT))
    }

    if (project.publish_inactive_members) {
      const [inactiveMembers] = await query(`
        SELECT DISTINCT u.user_id, u.fname, u.lname, u.email
        FROM stats_project_access AS a
        INNER JOIN ca_users as u ON a.user_id = u.user_id
        WHERE a.project_id = ?
        ORDER BY u.lname, u.fname`)
      for (const member of inactiveMembers) {
        const userId = member.user_id
        if (stats.has(userId)) {
          continue
        }
        const [[{ last_accessed_on }]] = await sequelizeConn.query(
          `
          SELECT MAX(datetime_started) AS last_accessed_on
          FROM stats_project_access
          WHERE user_id = ?`,
          {
            replacements: [userId],
            transaction,
          }
        )
        const memberStat = {
          member_name: member.fname + ' ' + member.lname,
          email: member.email,
          fname: member.fname,
          lname: member.lname,
          is_administrator: 0,
          last_accessed_on,
          member_role: 0,
          membership_status: 0,
        }
        stats.set(userId, Object.assign(memberStat, MEMBER_BASE_COUNT))
      }
    }

    const [taxaCounts] = await query(`
      SELECT user_id, COUNT(*) AS count
      FROM taxa
      WHERE project_id = ?
      GROUP BY user_id`)
    for (const result of taxaCounts) {
      stats.get(result.user_id).taxa_count = result.count
    }

    const [specimensCounts] = await query(`
      SELECT user_id, COUNT(*) AS count
      FROM specimens
      WHERE project_id = ?
      GROUP BY user_id`)
    for (const result of specimensCounts) {
      stats.get(result.user_id).specimen_count = result.count
    }

    const [mediaCounts] = await query(`
      SELECT user_id, COUNT(*) AS count
      FROM media_files mf
      WHERE
        ${mediaPublishedWhereClause}
        ${matrixMediaWhereClause}
        mf.project_id = ?
      GROUP BY user_id`)
    for (const result of mediaCounts) {
      stats.get(result.user_id).media_count = result.count
    }

    const [mediaNotesCounts] = await query(`
      SELECT user_id, COUNT(*) AS count
      FROM media_files mf
      WHERE
        ${mediaPublishedWhereClause}
        ${matrixMediaWhereClause}
        mf.notes != '' AND
        mf.project_id = ?
      GROUP BY user_id`)
    for (const result of mediaNotesCounts) {
      stats.get(result.user_id).media_notes_count = result.count
    }

    const [characterCounts] = await query(`
      SELECT c.user_id, COUNT(*) AS count
      FROM characters c
      INNER JOIN matrix_character_order AS mco ON mco.character_id = c.character_id
      ${matrixJoinClause}
      WHERE
        ${matrixPublishedWhereClause}
        c.project_id = ?
      GROUP BY c.user_id`)
    for (const result of characterCounts) {
      stats.get(result.user_id).character_count = result.count
    }

    const [characterCommentsCounts] = await query(`
      SELECT a.user_id, COUNT(DISTINCT a.annotation_id) AS count
      FROM annotations a
      INNER JOIN projects_x_users AS pxu ON a.user_id = pxu.user_id
      INNER JOIN characters AS c ON c.project_id = pxu.project_id AND c.character_id = a.row_id
      INNER JOIN matrix_character_order AS mco ON mco.character_id = c.character_id
      ${matrixJoinClause}
      WHERE
        ${matrixPublishedWhereClause}
        a.table_num = 3 AND
        c.project_id = ?
      GROUP BY a.user_id`)
    for (const result of characterCommentsCounts) {
      stats.get(result.user_id).character_comments_count = result.count
    }

    const [characterNotesCounts] = await query(`
      SELECT c.user_id, COUNT(DISTINCT c.character_id) AS count
      FROM characters AS c
      INNER JOIN matrix_character_order AS mco
        ON mco.character_id = c.character_id
      ${matrixJoinClause}
      WHERE
        ${matrixPublishedWhereClause}
        c.description <> '' AND
        c.project_id = ?
      GROUP BY c.user_id`)
    for (const result of characterNotesCounts) {
      stats.get(result.user_id).character_note_count = result.count
    }

    const [characterMediaCounts] = await query(`
      SELECT mf.user_id, COUNT(*) AS count
      FROM media_files mf
      INNER JOIN characters_x_media AS cxm
        ON mf.media_id = cxm.media_id
      INNER JOIN characters AS c
        ON c.character_id = cxm.character_id
      INNER JOIN matrix_character_order AS mco
        ON mco.character_id = c.character_id
      ${matrixJoinClause}
      WHERE
        ${matrixPublishedWhereClause}
        ${mediaPublishedWhereClause}
        ${matrixMediaWhereClause}
        mf.project_id = ?
      GROUP BY mf.user_id`)
    for (const result of characterMediaCounts) {
      stats.get(result.user_id).character_media_count = result.count
    }

    const [characterMediaLabelsCounts] = await query(`
      SELECT ml.user_id, COUNT(DISTINCT ml.label_id) AS count
      FROM media_labels ml
      INNER JOIN characters_x_media AS cxm
        ON ml.link_id = cxm.link_id
      INNER JOIN media_files AS mf
        ON cxm.media_id = mf.media_id
      INNER JOIN characters AS c 
        ON cxm.character_id = c.character_id
      INNER JOIN matrix_character_order AS mco
        ON mco.character_id = c.character_id
      ${matrixJoinClause}
      WHERE
        ${matrixPublishedWhereClause}
        ${mediaPublishedWhereClause}
        ${matrixMediaWhereClause}
        ml.table_num = 16 AND
        c.project_id = ?
      GROUP BY ml.user_id`)
    for (const result of characterMediaLabelsCounts) {
      stats.get(result.user_id).character_label_count = result.count
    }

    const [scoresCounts] = await query(`
      SELECT c.user_id, COUNT(*) AS count
      FROM cells c
      INNER JOIN matrices AS m ON m.matrix_id = c.matrix_id
      WHERE
        ${matrixPublishedWhereClause}
        m.project_id = ?
      GROUP BY c.user_id`)
    for (const result of scoresCounts) {
      stats.get(result.user_id).cell_count = result.count
    }

    const [noNpaCounts] = await query(`
      SELECT c.user_id, COUNT(*) AS count
      FROM cells c
      INNER JOIN matrices AS m ON m.matrix_id = c.matrix_id
      WHERE
        ${matrixPublishedWhereClause}
        c.is_npa = 0 AND
        c.state_id is NOT NULL AND
        m.project_id = ?
      GROUP BY c.user_id`)
    for (const result of noNpaCounts) {
      stats.get(result.user_id).cell_nonnpa_count = result.count
    }

    const [npaCounts] = await query(`
      SELECT c.user_id, COUNT(*) AS count
      FROM cells c
      INNER JOIN matrices AS m ON m.matrix_id = c.matrix_id
      WHERE
        ${matrixPublishedWhereClause}
        c.is_npa = 1 AND
        m.project_id = ?
      GROUP BY c.user_id`)
    for (const result of npaCounts) {
      stats.get(result.user_id).cell_npa_count = result.count
    }

    const [inapplicableScoreCounts] = await query(`
      SELECT c.user_id, COUNT(*) AS count
      FROM cells c
      INNER JOIN matrices AS m ON m.matrix_id = c.matrix_id
      WHERE
        ${matrixPublishedWhereClause}
        c.is_npa = 0 AND
        c.state_id is NULL AND
        m.project_id = ?
      GROUP BY c.user_id`)
    for (const result of inapplicableScoreCounts) {
      stats.get(result.user_id).cell_inapplicable_scores = result.count
    }

    const [cellCommentsCounts] = await query(`
      SELECT a.user_id, count(DISTINCT a.annotation_id) AS count
      FROM annotations a
      INNER JOIN matrices AS m ON a.row_id = m.matrix_id
      WHERE
        ${matrixPublishedWhereClause}
        a.table_num = 5 AND
        m.project_id = ?
      GROUP BY a.user_id`)
    for (const result of cellCommentsCounts) {
      stats.get(result.user_id).cell_comment_count = result.count
    }

    const [cellNotesCounts] = await query(`
      SELECT ccl.user_id, COUNT(*) AS count
      FROM cell_notes cn
      INNER JOIN matrices AS m
        ON cn.matrix_id = m.matrix_id
      INNER JOIN cell_change_log AS ccl
        ON cn.character_id = ccl.character_id AND
          cn.taxon_id = ccl.taxon_id AND
          cn.matrix_id = ccl.matrix_id
      WHERE
        ${matrixPublishedWhereClause}
        ccl.table_num = 29 AND
        ccl.change_type = 'I' AND
        cn.notes <> '' AND
        ccl.user_id > 1 AND
        m.project_id = ?
      GROUP BY ccl.user_id`)
    for (const result of cellNotesCounts) {
      stats.get(result.user_id).cell_note_count = result.count
    }

    const [cellMediaCounts] = await query(`
        SELECT cxm.user_id, COUNT(*) AS count
        FROM cells_x_media cxm
        INNER JOIN matrices AS m ON cxm.matrix_id = m.matrix_id
        INNER JOIN media_files AS mf ON cxm.media_id = mf.media_id
        WHERE
          ${matrixPublishedWhereClause}
          ${matrixMediaWhereClause}
          m.project_id = ?
        GROUP BY cxm.user_id`)
    for (const result of cellMediaCounts) {
      stats.get(result.user_id).cell_media_count = result.count
    }

    const [cellMediaLabelsCounts] = await query(`
      SELECT ml.user_id, COUNT(*) AS count
      FROM media_files mf
      INNER JOIN media_labels AS ml
        ON mf.media_id = ml.media_id AND ml.table_num = 7
      INNER JOIN cells_x_media AS cxm
        ON ml.link_id = cxm.link_id AND ml.media_id = cxm.media_id
      ${matrixJoinClause}
      WHERE
        ${matrixPublishedWhereClause}
        ${mediaPublishedWhereClause}
        ${matrixMediaWhereClause}
        mf.project_id = ?
      GROUP BY ml.user_id`)
    for (const result of cellMediaLabelsCounts) {
      stats.get(result.user_id).cell_label_count = result.count
    }

    const [rulesCounts] = await query(`
      SELECT cr.user_id, COUNT(*) AS count
      FROM character_rules cr
      INNER JOIN matrix_character_order AS mco
        ON cr.character_id = mco.character_id
      INNER JOIN matrices AS m
        ON mco.matrix_id = m.matrix_id
      WHERE
        ${matrixPublishedWhereClause}
        m.project_id = ?
      GROUP BY cr.user_id`)
    for (const result of rulesCounts) {
      stats.get(result.user_id).rule_count = result.count
    }

    if (project.published) {
      const [warningCounts] = await sequelizeConn.query(
        `
        SELECT
          lso.user_id, COUNT(*) AS count
        FROM (
          SELECT
            m.matrix_id, mco.character_id,
            MAX(ccl.changed_on) AS last_changed_on
          FROM character_change_log ccl
          INNER JOIN matrix_character_order AS mco
            ON mco.character_id = ccl.character_id
          INNER JOIN matrices AS m ON mco.matrix_id = m.matrix_id
          WHERE m.project_id = ? AND ccl.is_minor_edit = 0
          GROUP BY m.matrix_id, mco.character_id) AS lco
        INNER JOIN (
          SELECT
            pxu.user_id, m.matrix_id, ccl.character_id,
            MAX(ccl.changed_on) AS last_scored_on
          FROM cell_change_log ccl
          INNER JOIN matrix_character_order AS mco
            ON
              mco.matrix_id = ccl.matrix_id AND
              mco.character_id = ccl.character_id
          INNER JOIN matrix_taxa_order AS mto
            ON
              mto.matrix_id = ccl.matrix_id AND
              ccl.taxon_id = mto.taxon_id
          INNER JOIN matrices AS m
            ON mto.matrix_id = m.matrix_id
          INNER JOIN projects_x_users AS pxu
            ON pxu.project_id = m.project_id
          LEFT JOIN project_members_x_groups AS pmxg
            ON pmxg.membership_id = pxu.link_id
          WHERE
            (
              mto.group_id = pmxg.group_id OR
              mto.user_id IS NULL OR
              mto.group_id IS NULL) AND
            m.project_id = ?
          GROUP BY pxu.user_id, m.matrix_id, ccl.character_id) AS lso
          ON lso.character_id = lco. character_id AND
            lso.matrix_id = lco.matrix_id
        WHERE
          lco.last_changed_on < lso.last_scored_on
        GROUP BY lso.user_id`,
        {
          replacements: [projectId, projectId],
          transaction,
        }
      )
      for (const result of warningCounts) {
        stats.get(result.user_id).warnings_count += result.count
      }
    }

    const entries = []
    for (const [userId, stat] of stats.entries()) {
      entries.push([
        projectId,
        userId,
        stat.lname,
        stat.fname,
        stat.is_administrator,
        stat.membership_status,
        stat.email,
        stat.membership_status,
        stat.last_accessed_on,
        stat.taxa_count,
        stat.specimen_count,
        stat.media_count,
        stat.media_notes_count,
        stat.character_count,
        stat.character_comments_count,
        stat.character_note_count,
        stat.character_media_count,
        stat.character_label_count,
        stat.cell_count,
        stat.cell_nonnpa_count,
        stat.cell_npa_count,
        stat.cell_inapplicable_scores,
        stat.cell_comment_count,
        stat.cell_media_count,
        stat.cell_note_count,
        stat.cell_label_count,
        stat.rule_count,
        stat.warnings_count,
      ])
    }

    await sequelizeConn.query(
      `DELETE FROM stats_members_overview WHERE project_id = ?`,
      { replacements: [projectId], transaction }
    )

    await sequelizeConn.query(
      `
      INSERT INTO stats_members_overview (
        project_id, user_id, lname, fname, administrator, membership_status,
        member_email, member_role, last_access, taxa, specimens, media,
        media_notes, characters, character_comments, character_notes,
        character_media, character_media_labels, cell_scorings,
        cell_scorings_scored, cell_scorings_npa, cell_scorings_not,
        cell_comments, cell_media, cell_notes, cell_media_labels, rules,
        warnings)
      VALUES ?`,
      { replacements: [entries], transaction }
    )

    await transaction.commit()
    return entries
  }
}

const MEMBER_BASE_COUNT = {
  taxa_count: 0,
  specimen_count: 0,
  rule_count: 0,
  cell_label_count: 0,
  cell_media_count: 0,
  cell_note_count: 0,
  cell_comment_count: 0,
  cell_inapplicable_scores: 0,
  cell_npa_count: 0,
  cell_nonnpa_count: 0,
  cell_count: 0,
  character_label_count: 0,
  character_media_count: 0,
  character_note_count: 0,
  character_comments_count: 0,
  character_count: 0,
  media_notes_count: 0,
  media_count: 0,
  warnings_count: 0,
}
