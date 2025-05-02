import sequelizeConn from '../util/db.js'
import { CELL_BATCH_TYPES } from '../util/cells.js'
import { MATRIX_OPTIONS } from '../util/matrix.js'
import { Table } from '../lib/table.js'
import { HyperTable } from '../lib/hyper-table.js'
import { array_difference, array_intersect, time } from '../util/util.js'
import { getCitationText } from '../util/citation.js'
import { getMedia } from '../util/media.js'
import { getRoles } from '../services/user-roles-service.js'
import {
  getStatesIdsForCharacter,
  getTypesForCharacterIds,
} from '../services/character-service.js'
import { getTaxonName, TAXA_FIELD_NAMES } from '../util/taxa.js'
import { models } from '../models/init-models.js'
import { UserError } from '../lib/user-errors.js'
import { ForbiddenError } from '../lib/forbidden-error.js'
import { TABLE_NUMBERS } from '../lib/table-number.js'

export default class MatrixEditorService {
  constructor(project, matrix, user, readonly) {
    this.project = project
    this.matrix = matrix
    this.user = user
    this.readonly = readonly
  }

  static async create(projectId, matrixId, userId, readonly) {
    const project = await models.Project.findByPk(projectId)
    const matrix = await models.Matrix.findByPk(matrixId)
    const user = userId ? await models.User.findByPk(userId) : new models.User()
    return new MatrixEditorService(project, matrix, user, readonly)
  }

  async getCharacterData() {
    return {
      characters: await this.getCharacters(),
      character_rules: await this.getCharacterRules(),
      matrices: await this.getMatrices(),
      matrix_options: this.getOptions(),
      user: await this.getUserAccessInfo(),
    }
  }

  async getMatrixData() {
    return {
      characters: await this.getCharacters(),
      taxa: await this.getTaxa(),
      partitions: await this.getPartitions(),
      character_rules: await this.getCharacterRules(),
      matrix: this.getMatrixInfo(),
      matrix_options: this.getOptions(),
      user: await this.getUserAccessInfo(),
    }
  }

  async getCellData() {
    const [rows] = await sequelizeConn.query(
      `
      SELECT
        c.cell_id, c.taxon_id, c.character_id, c.state_id, c.user_id, c.is_npa,
        c.is_uncertain, c.created_on, c.start_value, c.end_value, ch.type
      FROM cells c
      INNER JOIN matrix_character_order AS mco
        ON mco.character_id = c.character_id AND mco.matrix_id = c.matrix_id
      INNER JOIN characters AS ch
        ON ch.character_id = mco.character_id
      INNER JOIN matrix_taxa_order AS mto
        ON mto.taxon_id = c.taxon_id AND mto.matrix_id = c.matrix_id
      WHERE c.matrix_id = ?
      ORDER BY c.taxon_id, c.character_id`,
      { replacements: [this.matrix.matrix_id] }
    )

    return {
      cells: await this.convertCellQueryToResults(rows),
    }
  }

  async fetchCellsData(taxaIds, characterIds) {
    const shouldLimitToPublishedData = await this.shouldLimitToPublishedData()

    const [cellRows] = await sequelizeConn.query(
      `
      SELECT
        c.cell_id, c.taxon_id, c.character_id, c.state_id, c.user_id, c.is_npa,
        c.is_uncertain, c.created_on, c.start_value, c.end_value, ch.type
      FROM cells c
      INNER JOIN matrix_character_order AS mco ON
        mco.character_id = c.character_id AND
        mco.matrix_id = c.matrix_id
      INNER JOIN characters AS ch ON
        ch.character_id = mco.character_id
      INNER JOIN matrix_taxa_order AS mto ON
        mto.taxon_id = c.taxon_id AND
        mto.matrix_id = c.matrix_id
      WHERE
        c.matrix_id = ? AND
        c.taxon_id IN (?) AND
        c.character_id IN (?)
      ORDER BY c.taxon_id, c.character_id`,
      { replacements: [this.matrix.matrix_id, taxaIds, characterIds] }
    )

    const mediaClause = shouldLimitToPublishedData ? 'mf.published = 0 AND' : ''
    const [labelCountRows] = await sequelizeConn.query(
      `
      SELECT cxm.media_id, cxm.taxon_id, cxm.character_id, count(*) label_count
      FROM media_labels ml
      INNER JOIN cells_x_media AS cxm ON
        ml.link_id = cxm.link_id AND
        cxm.media_id = ml.media_id
      INNER JOIN media_files AS mf ON
        cxm.media_id = mf.media_id
      WHERE
        ${mediaClause}
        cxm.matrix_id = ? AND
        cxm.taxon_id IN (?) AND
        cxm.character_id IN (?) AND
        ml.table_num = 7
      GROUP BY cxm.character_id, cxm.taxon_id, cxm.media_id`,
      { replacements: [this.matrix.matrix_id, taxaIds, characterIds] }
    )
    const labelCounts = new HyperTable()
    for (const row of labelCountRows) {
      const mediaId = parseInt(row.media_id)
      const taxonId = parseInt(row.taxon_id)
      const characterId = parseInt(row.character_id)
      const labelCount = parseInt(row.label_count)
      labelCounts.set(taxonId, characterId, mediaId, labelCount)
    }

    const [mediaRows] = await sequelizeConn.query(
      `
      SELECT
        cxm.media_id, cxm.taxon_id, cxm.character_id,
      mf.media, mf.notes, cxm.link_id
      FROM cells_x_media cxm
      INNER JOIN media_files AS mf ON cxm.media_id = mf.media_id
      WHERE
        ${mediaClause}
        cxm.matrix_id = ? AND
        cxm.taxon_id IN (?) AND
        cxm.character_id IN (?)
      GROUP BY cxm.link_id`,
      { replacements: [this.matrix.matrix_id, taxaIds, characterIds] }
    )

    const cellMedia = []
    for (const row of mediaRows) {
      const linkId = parseInt(row.link_id)
      const mediaId = parseInt(row.media_id)
      const taxonId = parseInt(row.taxon_id)
      const characterId = parseInt(row.character_id)
      cellMedia.push({
        link_id: linkId,
        media_id: mediaId,
        taxon_id: taxonId,
        character_id: characterId,
        tiny: getMedia(row.media, 'tiny'),
        icon: getMedia(row.media, 'icon'),
        label_count: labelCounts.get(taxonId, characterId, mediaId) ?? 0,
      })
    }

    const [cellNotesRows] = await sequelizeConn.query(
      `
      SELECT DISTINCT
        cn.note_id, cn.notes, cn.taxon_id, cn.character_id, cn.matrix_id,
        cn.status, cn.ancestor_note_id
      FROM cell_notes cn
      WHERE
        cn.matrix_id = ? AND
        cn.taxon_id IN (?) AND
        cn.character_id IN (?)`,
      { replacements: [this.matrix.matrix_id, taxaIds, characterIds] }
    )
    const cellNotes = []
    for (const cellNoteRow of cellNotesRows) {
      cellNotes.push({
        character_id: cellNoteRow.character_id,
        taxon_id: cellNoteRow.taxon_id,
        status: cellNoteRow.status,
        notes: cellNoteRow.notes,
      })
    }

    const cells = {
      taxa_ids: taxaIds,
      character_ids: characterIds,
      cells: await this.convertCellQueryToResults(cellRows),
      notes: cellNotes,
      media: cellMedia,
    }

    if (shouldLimitToPublishedData) {
      const [citationCountRows] = await sequelizeConn.query(
        `
      SELECT count(*) citation_count, cxbr.taxon_id, cxbr.character_id
      FROM cells_x_bibliographic_references cxbr
      WHERE
        cxbr.matrix_id = ? AND
        cxbr.taxon_id IN (?) AND
        cxbr.character_id IN (?)
      GROUP BY
        cxbr.taxon_id, cxbr.character_id`,
        { replacements: [this.matrix.matrix_id, taxaIds, characterIds] }
      )

      const citationCounts = {}
      for (const row of citationCountRows) {
        const characterId = parseInt(row.character_id)
        const taxonId = parseInt(row.taxon_id)
        if (!(taxonId in citationCounts)) {
          citationCounts[taxonId] = {}
        }
        citationCounts[taxonId][characterId] = parseInt(row.citation_count)
      }
      cells.counts = {
        citation_counts: citationCounts,
      }
    }
    return cells
  }

  async getCellCounts(
    startCharacterNum,
    endCharacterNum,
    startTaxonNum,
    endTaxonNum
  ) {
    const [citationCountRows] = await sequelizeConn.query(
      `
      SELECT count(*) citation_count, cxbr.taxon_id, cxbr.character_id
      FROM cells_x_bibliographic_references cxbr
      INNER JOIN matrix_character_order AS mco
        ON mco.character_id = cxbr.character_id AND cxbr.matrix_id = mco.matrix_id
      INNER JOIN matrix_taxa_order AS mto
        ON mto.taxon_id = cxbr.taxon_id AND cxbr.matrix_id = mto.matrix_id
      WHERE
        cxbr.matrix_id = ? AND
        mco.position >= ? AND mco.position <= ? AND
        mto.position >= ? AND mto.position <= ?
      GROUP BY
        cxbr.taxon_id, cxbr.character_id`,
      {
        replacements: [
          this.matrix.matrix_id,
          startCharacterNum,
          endCharacterNum,
          startTaxonNum,
          endTaxonNum,
        ],
      }
    )
    const citationCounts = {}
    for (const row of citationCountRows) {
      const characterId = parseInt(row.character_id)
      const taxonId = parseInt(row.taxon_id)
      if (!(taxonId in citationCounts)) {
        citationCounts[taxonId] = {}
      }
      citationCounts[taxonId][characterId] = parseInt(row.citation_count)
    }

    if (await this.shouldLimitToPublishedData()) {
      return {
        counts: { citation_counts: citationCounts },
      }
    }

    const [lastChangeTimesRows] = await sequelizeConn.query(
      `
      SELECT c.character_id, c.taxon_id, max(changed_on) last_change
      FROM cell_change_log c
      INNER JOIN matrix_character_order AS mco
        ON mco.character_id = c.character_id AND mco.matrix_id = c.matrix_id
      INNER JOIN matrix_taxa_order AS mto
        ON mto.taxon_id = c.taxon_id AND mto.matrix_id = c.matrix_id
      WHERE
        c.matrix_id = ? AND
        mco.position >= ? AND mco.position <= ? AND
        mto.position >= ? AND mto.position <= ?
      GROUP BY
        character_id, taxon_id`,
      {
        replacements: [
          this.matrix.matrix_id,
          startCharacterNum,
          endCharacterNum,
          startTaxonNum,
          endTaxonNum,
        ],
      }
    )
    const changeTimes = {}
    for (const row of lastChangeTimesRows) {
      const characterId = parseInt(row.character_id)
      const taxonId = parseInt(row.taxon_id)
      if (!(taxonId in changeTimes)) {
        changeTimes[taxonId] = {}
      }
      changeTimes[taxonId][characterId] = parseInt(row.last_change)
    }

    const [commentCountRows] = await sequelizeConn.query(
      `
      SELECT count(*) c, a.specifier_id, a.subspecifier_id
      FROM annotations a
      WHERE a.row_id = ? AND a.table_num = 5
      GROUP BY a.specifier_id, a.subspecifier_id`,
      { replacements: [this.matrix.matrix_id] }
    )
    const commentCounts = {}
    for (const row of commentCountRows) {
      const characterId = parseInt(row.specifier_id)
      const taxonId = parseInt(row.subspecifier_id)
      if (!(taxonId in commentCounts)) {
        commentCounts[taxonId] = {}
      }
      commentCounts[taxonId][characterId] = parseInt(row.c)
    }

    const [unreadCommentCountRows] = await sequelizeConn.query(
      `
      SELECT count(*) c, a.specifier_id, a.subspecifier_id
      FROM annotations AS a
      LEFT JOIN (
        SELECT a2.annotation_id
        FROM annotation_events ae
        INNER JOIN annotations AS a2 ON
          a2.annotation_id = ae.annotation_id AND
          a2.row_id = ? AND
          a2.table_num = 5
        WHERE ae.user_id = ?
        GROUP BY a2.annotation_id
      ) AS ce ON a.annotation_id = ce.annotation_id
      WHERE ce.annotation_id IS NULL AND a.row_id = ? AND a.table_num = 5
      GROUP BY a.specifier_id, a.subspecifier_id`,
      {
        replacements: [
          this.matrix.matrix_id,
          this.user.user_id,
          this.matrix.matrix_id,
        ],
      }
    )
    const unreadCommentCount = {}
    for (const row of unreadCommentCountRows) {
      const characterId = parseInt(row.specifier_id)
      const taxonId = parseInt(row.subspecifier_id)
      if (!(taxonId in unreadCommentCount)) {
        unreadCommentCount[taxonId] = {}
      }
      unreadCommentCount[taxonId][characterId] = parseInt(row.c)
    }

    return {
      counts: {
        updates: changeTimes,
        citation_counts: citationCounts,
        comment_counts: commentCounts,
        unread_comment_counts: unreadCommentCount,
      },
    }
  }

  async getAllCellNotes() {
    const [rows] = await sequelizeConn.query(
      `
      SELECT cn.taxon_id, cn.character_id, cn.status, cn.notes
      FROM cell_notes cn
      WHERE cn.matrix_id = ?`,
      { replacements: [this.matrix.matrix_id] }
    )

    const notes = []
    for (const row of rows) {
      notes.push({
        character_id: parseInt(row.character_id),
        taxon_id: parseInt(row.taxon_id),
        status: parseInt(row.status),
        notes: row.notes,
      })
    }

    return { notes: notes }
  }

  async getCellMedia() {
    const clause = this.shouldLimitToPublishedData()
      ? ' AND mf.published = 0'
      : ''

    const [labelCountRows] = await sequelizeConn.query(
      `
      SELECT cxm.media_id, cxm.taxon_id, cxm.character_id, count(*) label_count
      FROM media_labels ml
      INNER JOIN cells_x_media AS cxm ON ml.link_id = cxm.link_id AND cxm.media_id = ml.media_id
      INNER JOIN media_files AS mf ON cxm.media_id = mf.media_id
      WHERE cxm.matrix_id = ? AND ml.table_num = 7 ${clause}
      GROUP BY cxm.character_id, cxm.taxon_id, cxm.media_id`,
      { replacements: [this.matrix.matrix_id] }
    )

    const labelCounts = new HyperTable()
    for (const row of labelCountRows) {
      const taxonId = parseInt(row.taxon_id)
      const characterId = parseInt(row.character_id)
      const mediaId = parseInt(row.media_id)
      const count = parseInt(row.label_count)
      labelCounts.set(taxonId, characterId, mediaId, count)
    }

    const [mediaRows] = await sequelizeConn.query(
      `
      SELECT
        cxm.media_id, cxm.taxon_id, cxm.character_id,
        mf.media, mf.notes, cxm.link_id
      FROM cells_x_media cxm
      INNER JOIN media_files AS mf ON cxm.media_id = mf.media_id
      WHERE cxm.matrix_id = ? ${clause}
      GROUP BY cxm.link_id`,
      { replacements: [this.matrix.matrix_id] }
    )

    const mediaList = []
    for (const row of mediaRows) {
      const linkId = parseInt(row.link_id)
      const taxonId = parseInt(row.taxon_id)
      const characterId = parseInt(row.character_id)
      const mediaId = parseInt(row.media_id)
      const media = {
        link_id: linkId,
        taxon_id: taxonId,
        character_id: characterId,
        media_id: mediaId,
        tiny: getMedia(row.media, 'tiny'),
        icon: getMedia(row.media, 'icon'),
      }

      const labelCount = labelCounts.get(taxonId, characterId, mediaId)
      if (labelCount) {
        media.label_count = labelCount
      }

      mediaList.push(media)
    }

    return { media: mediaList }
  }

  async getLabelCount(linkId) {
    const cellMedium = await models.CellsXMedium.findByPk(linkId)
    if (!cellMedium) {
      return {}
    }
    return {
      taxon_id: cellMedium.taxon_id,
      character_id: cellMedium.character_id,
      media_id: cellMedium.media_id,
      label_count: await this.getMediaLabelCount(linkId),
    }
  }

  async getMediaLabelCount(linkId) {
    const [[{ count }]] = await sequelizeConn.query(
      `
      SELECT COUNT(*) AS count
      FROM media_labels ml
      INNER JOIN cells_x_media AS cxm ON cxm.link_id = ml.link_id
      INNER JOIN media_files AS mf ON mf.media_id = ml.media_id
      WHERE ml.table_num = ? AND cxm.link_id = ?`,
      { replacements: [TABLE_NUMBERS.cells_x_media, linkId] }
    )
    return parseInt(count) ?? 0
  }

  async getCellCitations(taxonId, characterId) {
    const [rows] = await sequelizeConn.query(
      `
      SELECT *
      FROM bibliographic_references br
      INNER JOIN cells_x_bibliographic_references AS cxbr ON cxbr.reference_id = br.reference_id
      WHERE
        cxbr.matrix_id = ? AND cxbr.taxon_id = ? AND cxbr.character_id = ?`,
      { replacements: [this.matrix.matrix_id, taxonId, characterId] }
    )

    const citations = []
    for (const row of rows) {
      citations.push({
        link_id: parseInt(row.link_id),
        citation_id: parseInt(row.reference_id),
        name: getCitationText(row),
        notes: row.notes,
        pp: row.pp,
      })
    }

    // TODO(kenzley): Make this into a matrix option so that users can have
    //     this as a matrix option.
    if (this.project.project_id == 773) {
      const [rows] = await sequelizeConn.query(
        `
        SELECT br.*, mfxbr.pp, cxm.character_id, cxm.taxon_id, cxm.matrix_id
        FROM cells_x_media cxm
        INNER JOIN media_files_x_bibliographic_references AS mfxbr ON
          cxm.media_id = mfxbr.media_id
        INNER JOIN media_files AS mf ON
          mf.media_id = cxm.media_id
        LEFT JOIN cells_x_bibliographic_references AS cxbr ON
          cxbr.taxon_id = cxm.taxon_id AND
          cxbr.character_id = cxm.character_id AND
          cxbr.matrix_id = cxm.matrix_id AND
          cxbr.reference_id = mfxbr.reference_id
        INNER JOIN bibliographic_references AS br ON
          br.reference_id = mfxbr.reference_id
        WHERE
          cxbr.link_id IS NULL AND
          cxm.matrix_id = ? AND cxm.taxon_id = ? AND cxm.character_id = ?
        GROUP BY br.reference_id`,
        { replacements: [this.matrix.matrix_id, taxonId, characterId] }
      )
      for (const row of rows) {
        citations.push({
          link_id: 0,
          citation_id: parseInt(row.citation_id),
          name: getCitationText(row),
          notes: 'Affiliated with cell media',
          pp: row.pp,
        })
      }
    }

    return { citations: citations }
  }

  async getMatrices() {
    const [rows] = await sequelizeConn.query(
      'SELECT matrix_id, title, type FROM matrices WHERE project_id = ?',
      { replacements: [this.project.project_id] }
    )

    const matrices = []
    for (const row of rows) {
      matrices.push({
        id: parseInt(row.matrix_id),
        ty: parseInt(row.type),
        t: row.title,
      })
    }
    return matrices
  }

  // TODO(kenzley): We need to implement this when the search engine is done.
  async findCitation(text) {
    const citations = []
    return { text: text, citations: citations }
  }

  async addCellCitations(
    taxaIds,
    characterIds,
    citationId,
    pp,
    notes,
    batchMode
  ) {
    await this.checkCanDo(
      'editCellData',
      'You are not allowed to add citations for cells'
    )

    if (taxaIds.length == 0) {
      throw new UserError('Please specify at least one taxon')
    }

    if (characterIds.length == 0) {
      throw new UserError('Please specify at least one character')
    }

    await this.checkCanEditTaxa(taxaIds)
    await this.checkCanEditCharacters(characterIds)

    const citation = await models.BibliographicReference.findByPk(citationId)
    if (citation == null) {
      throw new UserError('Citation does not exist')
    }

    const transaction = await sequelizeConn.transaction()

    let cellBatch
    if (batchMode) {
      cellBatch = models.CellBatchLog.build({
        user_id: this.user.user_id,
        matrix_id: this.matrix.matrix_id,
        batch_type: CELL_BATCH_TYPES.ADD_CELL_CITATION,
        started_on: time(),
      })
    }

    const citations = []
    for (const taxonId of taxaIds) {
      for (const characterId of characterIds) {
        const [link] = await models.CellsXBibliographicReference.findOrCreate({
          where: {
            matrix_id: this.matrix.matrix_id,
            taxon_id: taxonId,
            character_id: characterId,
            reference_id: citationId,
          },
          defaults: {
            matrix_id: this.matrix.matrix_id,
            taxon_id: taxonId,
            character_id: characterId,
            reference_id: citationId,
            user_id: this.user.user_id,
            pp: pp,
            notes: notes,
            source: 'HTML5',
          },
          transaction: transaction,
        })
        if (link) {
          citations.push({
            link_id: link.link_id,
            taxon_id: taxonId,
            character_id: characterId,
          })
        }
      }
    }

    if (batchMode) {
      let description = 'Added cell citations to '
      if (batchMode == 2) {
        const character = await models.Character.findByPk(characterIds[0])
        description += `${taxaIds.length} taxa in ${character.name} column`
      } else if (batchMode == 1) {
        const taxon = await models.Taxon.findByPk(taxaIds[0])
        description += `${characterIds.length} characters in ${getTaxonName(
          taxon
        )} row`
      } else {
        throw new UserError('Unable batch mode')
      }

      cellBatch.finished_on = time()
      cellBatch.description = description
      await cellBatch.save({ user: this.user, transaction: transaction })
    }

    await transaction.commit()
    return {
      citations: citations,
      citation_id: citationId,
      pp: pp,
      notes: notes,
      name: await getCitationText(citation),
    }
  }

  async upsertCellCitation(
    linkId,
    taxonId,
    characterId,
    citationId,
    pp,
    notes
  ) {
    await this.checkCanDo(
      'editCellData',
      'You are not allowed to add citations for cells'
    )

    const transaction = await sequelizeConn.transaction()

    const [link, built] = await models.CellsXBibliographicReference.findOrBuild(
      {
        where: {
          link_id: linkId,
        },
        defaults: {
          matrix_id: this.matrix.matrix_id,
          taxon_id: taxonId,
          character_id: characterId,
          reference_id: citationId,
          user_id: this.user.user_id,
          pp: pp,
          notes: notes,
          source: 'HTML5',
        },
        user: this.user,
        transaction: transaction,
      }
    )

    await this.checkCanEditTaxa([link.taxon_id])
    await this.checkCanEditCharacters([link.character_id])

    const citation = await models.BibliographicReference.findByPk(citationId)
    if (citation == null) {
      throw new UserError('Citation does not exist')
    }

    if (built) {
      await link.save({ user: this.user, transaction: transaction })
    } else {
      if (link.matrix_id != this.matrix.matrix_id) {
        throw new UserError('Citation is not for the specified matrix')
      }
      if (link.taxon_id != taxonId) {
        throw new UserError('Citation is not match given taxon')
      }
      if (link.character_id != characterId) {
        throw new UserError('Citation is not match given character')
      }
      if (link.reference_id != citationId) {
        throw new UserError('Cell Citation does not match the citation')
      }

      link.pp = pp
      link.notes = notes
      await link.save({ user: this.user, transaction: transaction })
    }

    await transaction.commit()
    return {
      citation: {
        link_id: parseInt(link.link_id),
        citation_id: citationId,
        pp: pp,
        notes: notes,
        name: await getCitationText(citation),
      },
    }
  }

  async removeCellCitation(linkId) {
    await this.checkCanDo(
      'editCellData',
      'You are not allowed to remove citations for cells'
    )

    const link = await models.CellsXBibliographicReference.findByPk(linkId)
    if (link == null) {
      // Citation does not exist and therefore should be considered removed from
      // the matrix. This happens when another user deletes the citation from
      // the matrix but the current user still has a reference to it on the
      // client.
      return { link_id: linkId }
    }

    if (link.matrix_id != this.matrix.matrix_id) {
      throw new UserError('Citation is not for the specified matrix')
    }

    await this.checkCanEditTaxa([link.taxon_id])
    await this.checkCanEditCharacters([link.character_id])

    const transaction = await sequelizeConn.transaction()
    await link.destroy({ user: this.user, transaction: transaction })
    await transaction.commit()

    return { link_id: linkId }
  }

  async getCharacters(characterIds = null) {
    let characterIdsClause = ''
    const replacements = [this.matrix.matrix_id]
    if (Array.isArray(characterIds) && characterIds.length > 0) {
      characterIdsClause = 'AND ch.character_id IN (?)'
      replacements.push(characterIds)
    }

    const [rows] = await sequelizeConn.query(
      `
      SELECT
        ch.character_id, ch.name AS name, ch.user_id, ch.description, ch.ordering, ch.type,
        mco.position
      FROM characters ch
      INNER JOIN matrix_character_order AS mco ON mco.character_id = ch.character_id
      INNER JOIN matrices AS m ON m.matrix_id = mco.matrix_id
      WHERE m.matrix_id = ? ${characterIdsClause}
      ORDER BY mco.position, ch.character_id`,
      { replacements: replacements }
    )

    const foundCharacterIds = []
    const characterList = []
    for (const row of rows) {
      const characterId = parseInt(row.character_id)
      foundCharacterIds.push(characterId)
      characterList.push({
        id: characterId,
        n: row.name,
        r: row.position,
        d: row.description,
        uid: row.user_id,
        o: row.ordering,
        t: row.type,
      })
    }

    const shouldLimitToPublishedData = this.shouldLimitToPublishedData()

    const states = new Map()
    if (foundCharacterIds.length > 0) {
      const [rows] = await sequelizeConn.query(
        `
          SELECT character_id, state_id, num, name
          FROM character_states
          WHERE character_id IN (?)
          ORDER BY character_id, num`,
        { replacements: [foundCharacterIds] }
      )
      for (const row of rows) {
        const characterId = parseInt(row.character_id)
        const state = {
          id: row.state_id,
          r: row.num,
          n: row.name,
        }
        if (!states.has(characterId)) {
          states.set(characterId, [])
        }
        states.get(characterId).push(state)
      }
    }

    const mediaList = await this.getMediaForCharacters(foundCharacterIds)

    let commentCounts = new Map()
    let unreadCommentCounts = new Map()
    let citationCounts = new Map()
    let lastChangedTimestamps = new Map()
    let userLastScoredTimestamps = new Map()
    if (!shouldLimitToPublishedData) {
      commentCounts = await this.getCommentCounts()
      unreadCommentCounts = await this.getUnreadCommentCounts()
      citationCounts = await this.getCitationCounts()
      lastChangedTimestamps = await this.getCharactersLastChangeTimes()
      userLastScoredTimestamps = await this.getCharacterLastUserScoringTimes()
    }

    for (const character of characterList) {
      const characterId = character.id
      character['bc'] = citationCounts.get(characterId) ?? 0
      character['cc'] = commentCounts.get(characterId) ?? 0
      character['ucc'] = unreadCommentCounts.get(characterId) ?? 0
      character['lco'] = lastChangedTimestamps.get(characterId) ?? 0
      character['lso'] = userLastScoredTimestamps.get(characterId) ?? 0
      character['m'] = mediaList.get(characterId) ?? {}
      character['s'] = states.get(characterId) ?? {}
    }

    return characterList
  }

  async getPartitions(partitionIds = null) {
    const replacements = [this.matrix.matrix_id]
    let clause = ''
    if (partitionIds) {
      clause = 'AND p.partition_id IN (?)'
      replacements.push(partitionIds)
    }

    const [characterRows] = await sequelizeConn.query(
      `
      SELECT cxp.partition_id, cxp.character_id
      FROM characters_x_partitions cxp
      INNER JOIN matrix_character_order AS mco ON
        mco.character_id = cxp.character_id
      INNER JOIN matrices AS m ON
        m.matrix_id = mco.matrix_id
      INNER JOIN partitions AS p ON
        p.project_id = m.project_id AND
        p.partition_id = cxp.partition_id
      WHERE m.matrix_id = ? ${clause}`,
      { replacements: replacements }
    )
    const characters = new Map()
    for (const row of characterRows) {
      const partitionId = parseInt(row.partition_id)
      const characterId = parseInt(row.character_id)
      if (!characters.has(partitionId)) {
        characters.set(partitionId, [])
      }
      characters.get(partitionId).push(characterId)
    }

    const [taxaRows] = await sequelizeConn.query(
      `
      SELECT txp.partition_id, txp.taxon_id
      FROM taxa_x_partitions txp
      INNER JOIN matrix_taxa_order AS mto ON
        mto.taxon_id = txp.taxon_id
      INNER JOIN matrices AS m ON
        m.matrix_id = mto.matrix_id
      INNER JOIN partitions AS p ON
        p.project_id = m.project_id AND
        p.partition_id = txp.partition_id
      WHERE m.matrix_id = ? ${clause}`,
      { replacements: replacements }
    )
    const taxa = new Map()
    for (const row of taxaRows) {
      const partitionId = parseInt(row.partition_id)
      const taxonId = parseInt(row.taxon_id)
      if (!taxa.has(partitionId)) {
        taxa.set(partitionId, [])
      }
      taxa.get(partitionId).push(taxonId)
    }

    const [partitionRows] = await sequelizeConn.query(
      `
      SELECT p.*
      FROM partitions p
      INNER JOIN matrices AS m ON p.project_id = m.project_id
      WHERE m.matrix_id = ? ${clause}
      ORDER BY p.name`,
      { replacements: replacements }
    )

    const partitions = []
    for (const row of partitionRows) {
      const partitionId = parseInt(row.partition_id)
      partitions.push({
        id: partitionId,
        name: row.name,
        description: row.description,
        project_id: parseInt(row.project_id),
        character_ids: characters.get(partitionId) ?? [],
        taxa_ids: taxa.get(partitionId) ?? [],
      })
    }
    return partitions
  }

  async shouldLimitToPublishedData() {
    const roles = await this.getRoles()
    const isAnonymousReviewer = roles.includes('anonymous_reviewer')
    return this.project.published == 1 || isAnonymousReviewer || this.readonly
  }

  getRoles() {
    if (!this.roles) {
      this.roles = getRoles(this.user.user_id)
    }
    return this.roles
  }

  async getMediaForCharacters(characterIds = null) {
    const replacements = [this.matrix.matrix_id]

    let clause = ''
    if (Array.isArray(characterIds) && characterIds.length > 0) {
      clause = ' AND mco.character_id IN (?)'
      replacements.push(characterIds)
    }

    if (this.shouldLimitToPublishedData()) {
      clause += ' AND mf.published = 0'
    }

    const [rows] = await sequelizeConn.query(
      `
      SELECT
        cxm.link_id, c.character_id, cs.state_id, mf.media_id, mf.media
      FROM characters_x_media cxm
      LEFT JOIN character_states AS cs ON cxm.state_id = cs.state_id
      INNER JOIN media_files AS mf ON mf.media_id = cxm.media_id
      INNER JOIN characters AS c ON c.character_id = cxm.character_id
      INNER JOIN matrix_character_order AS mco ON mco.character_id = c.character_id
      WHERE mco.matrix_id = ? ${clause}
      ORDER BY ISNULL(cs.num), cs.num, cs.name`,
      { replacements: replacements }
    )

    const mediaList = new Map()
    const versions = ['tiny', 'small', 'medium', 'icon']
    for (const row of rows) {
      const media = {
        link_id: parseInt(row.link_id),
        character_id: parseInt(row.character_id),
        media_id: parseInt(row.media_id),
        state_id: row.state_id == null ? null : parseInt(row.state_id),
      }
      for (const version of versions) {
        media[version] = getMedia(row.media, version)
      }

      const characterId = parseInt(row.character_id)
      if (!mediaList.has(characterId)) {
        mediaList.set(characterId, [])
      }
      mediaList.get(characterId).push(media)
    }

    return mediaList
  }

  async getTaxa(taxaIds = null) {
    const replacements = [this.matrix.matrix_id]

    let clause = ''
    if (Array.isArray(taxaIds) && taxaIds.length > 0) {
      clause = ' AND t.taxon_id IN (?)'
      replacements.push(taxaIds)
    }

    const columnNames = TAXA_FIELD_NAMES.join()
    const [rows] = await sequelizeConn.query(
      `
      SELECT DISTINCT
        t.taxon_id, ${columnNames},
        t.scientific_name_author, t.scientific_name_year,
        t.color, t.user_id taxon_user_id, t.notes, t.is_extinct,
        mto.notes matrix_notes, mto.position, mto.user_id, mto.group_id,
        wu.fname, wu.lname, wu.email
      FROM taxa t
      INNER JOIN matrix_taxa_order AS mto ON mto.taxon_id = t.taxon_id
      INNER JOIN matrices AS m ON m.matrix_id = mto.matrix_id
      INNER JOIN ca_users AS wu ON wu.user_id = t.user_id
      WHERE m.matrix_id = ? AND mto.matrix_id = m.matrix_id ${clause}
      ORDER BY mto.position`,
      { replacements: replacements }
    )

    const mediaList = await this.getMediaForTaxa(taxaIds)

    const taxaList = []
    let position = 0
    for (const row of rows) {
      const taxonId = parseInt(row.taxon_id)
      const userId = parseInt(row.user_id)
      const groupId = parseInt(row.group_id)
      const taxonName = getTaxonName(
        row,
        /* out= */ null,
        /* showExtinctMarker= */ true,
        /* showAuthor= */ false,
        /* skipSubgenus= */ true
      )
      taxaList.push({
        id: taxonId,
        gid: groupId,
        uid: userId,
        r: ++position, // sometimes the position is misnumbered based on previous deletions.
        n: row.notes,
        dn: taxonName,
        on: taxonName,
        m: mediaList.get(taxonId) ?? {},
      })
    }
    return taxaList
  }

  async getCharacterRules() {
    const [rows] = await sequelizeConn.query(
      `
      SELECT
        cr.rule_id, cr.character_id, cr.state_id, cra.action_id,
        cra.character_id action_character_id, cra.state_id action_state_id, cra.action
      FROM character_rules cr
      INNER JOIN character_rule_actions AS cra ON cr.rule_id = cra.rule_id
      INNER JOIN matrix_character_order AS mco ON mco.character_id = cr.character_id
      INNER JOIN characters AS c ON cr.character_id = c.character_id
      LEFT JOIN character_states AS cs ON cr.state_id = cs.state_id
      INNER JOIN characters AS ca ON cra.character_id = ca.character_id
      LEFT JOIN character_states AS csa ON cra.state_id = csa.state_id
      INNER JOIN matrix_character_order AS mcoa
        ON mcoa.character_id = cra.character_id AND mcoa.matrix_id = mco.matrix_id
      WHERE mco.matrix_id = ?
      ORDER BY mco.position, mcoa.position`,
      { replacements: [this.matrix.matrix_id] }
    )

    const rules = []
    for (const row of rows) {
      rules.push({
        id: parseInt(row.rule_id),
        cd: parseInt(row.character_id),
        acd: parseInt(row.action_character_id),
        ad: parseInt(row.action_id),
        sd: row.state_id == null ? null : parseInt(row.state_id),
        asd: row.action_state_id == null ? null : parseInt(row.action_state_id),
        a: row.action,
      })
    }
    return rules
  }

  async getAvailableTaxa() {
    const columnNames = TAXA_FIELD_NAMES.map((f) => 't.' + f).join()
    const [rows] = await sequelizeConn.query(
      `
      SELECT DISTINCT
        t.taxon_id, ${columnNames},
        t.scientific_name_author, t.scientific_name_year,
        t.color, t.user_id, t.notes, t.is_extinct,
        wu.fname, wu.lname, wu.email
      FROM taxa t
      INNER JOIN ca_users AS wu ON wu.user_id = t.user_id
      WHERE
        t.project_id = ? AND
        t.taxon_id NOT IN (SELECT taxon_id FROM matrix_taxa_order WHERE matrix_id = ?)
      ORDER BY t.genus, t.specific_epithet`,
      { replacements: [this.project.project_id, this.matrix.matrix_id] }
    )

    const media = await this.getTaxonMedia()

    const taxa = []
    for (const row of rows) {
      const taxonId = parseInt(row.taxon_id)
      const userId = parseInt(row.user_id)
      const taxonName = getTaxonName(row, null, true, false, true)
      taxa.push({
        id: taxonId,
        uid: userId,
        n: row.notes,
        dn: taxonName,
        on: taxonName,
        m: media.get(taxonId) ?? {},
      })
    }
    return { taxa: taxa }
  }

  async addTaxaToMatrix(taxaIds, afterTaxonId) {
    await this.checkCanDo('addTaxon', 'You are not allowed to add taxa')
    if (taxaIds.length == 0) {
      throw new UserError('No taxa was specified')
    }

    // Ensure that all of the taxa belongs to this project. This ensures that
    // the user is not passing in invalid taxa.
    const [[{ count }]] = await sequelizeConn.query(
      `
      SELECT COUNT(*) AS count
      FROM taxa
      WHERE project_id = ? AND taxon_id IN (?)`,
      { replacements: [this.project.project_id, taxaIds] }
    )
    if (count != taxaIds.length) {
      throw new UserError('Taxa is not in this project')
    }

    let position
    if (afterTaxonId > 0) {
      const insertion = await models.MatrixTaxaOrder.findOne({
        where: {
          taxon_id: afterTaxonId,
          matrix_id: this.matrix.matrix_id,
        },
      })
      if (insertion == null) {
        throw new UserError('Insertion position is not valid')
      }
      position = insertion.position + 1
    } else {
      position = 1
    }

    const transaction = await sequelizeConn.transaction()

    await sequelizeConn.query(
      `
        UPDATE matrix_taxa_order
        SET position = position + ?
        WHERE position >= ? AND matrix_id = ?
        ORDER BY position DESC`,
      {
        replacements: [taxaIds.length, position, this.matrix.matrix_id],
        transaction: transaction,
      }
    )

    const values = []
    for (const taxonId of taxaIds) {
      values.push(
        `(${this.matrix.matrix_id}, ${taxonId}, ${
          this.user.user_id
        }, '', ${position++})`
      )
    }

    await sequelizeConn.query(
      `
      INSERT IGNORE INTO matrix_taxa_order(matrix_id, taxon_id, user_id, notes, position)
      VALUES ${values.join(',')}`,
      { transaction: transaction }
    )

    await sequelizeConn.query(
      `
      UPDATE matrix_taxa_order
      SET position=@tmp_position:=@tmp_position+1
      WHERE matrix_id = ? AND (@tmp_position:=0)+1
      ORDER BY position`,
      { replacements: [this.matrix.matrix_id], transaction: transaction }
    )

    await this.logMatrixChange(transaction)

    await transaction.commit()
    return {
      taxa_ids: taxaIds,
      after_taxon_id: afterTaxonId,
    }
  }

  async removeTaxaFromMatrix(taxaIds) {
    if (!(await this.isAdminLike())) {
      throw new UserError(
        'You must be an administrator to remove a taxon from this matrix'
      )
    }

    if (taxaIds.length == 0) {
      throw new UserError('Please select taxa to remove')
    }

    const transaction = await sequelizeConn.transaction()

    // Delete all references to the cells related to the taxa.
    await sequelizeConn.query(
      `
        DELETE ml FROM media_labels ml
        INNER JOIN cells_x_media AS cm ON ml.link_id = cm.link_id
        WHERE ml.table_num = 7 AND cm.taxon_id IN (?) AND cm.matrix_id = ?`,
      {
        replacements: [taxaIds, this.matrix.matrix_id],
        transaction: transaction,
      }
    )
    await sequelizeConn.query(
      'DELETE FROM cells_x_media WHERE taxon_id IN (?) AND matrix_id = ?',
      {
        replacements: [taxaIds, this.matrix.matrix_id],
        transaction: transaction,
      }
    )
    await sequelizeConn.query(
      'DELETE FROM cells WHERE taxon_id IN (?) AND matrix_id = ?',
      {
        replacements: [taxaIds, this.matrix.matrix_id],
        transaction: transaction,
      }
    )
    await sequelizeConn.query(
      'DELETE FROM cell_notes WHERE taxon_id IN (?) AND matrix_id = ?',
      {
        replacements: [taxaIds, this.matrix.matrix_id],
        transaction: transaction,
      }
    )
    await sequelizeConn.query(
      'DELETE FROM cells_x_bibliographic_references WHERE taxon_id IN (?) AND matrix_id = ?',
      {
        replacements: [taxaIds, this.matrix.matrix_id],
        transaction: transaction,
      }
    )
    await sequelizeConn.query(
      'DELETE FROM annotations WHERE table_num = 5 AND subspecifier_id IN (?) AND row_id = ?',
      {
        replacements: [taxaIds, this.matrix.matrix_id],
        transaction: transaction,
      }
    )
    await sequelizeConn.query(
      'DELETE FROM matrix_taxa_order WHERE taxon_id IN (?) AND matrix_id = ?',
      {
        replacements: [taxaIds, this.matrix.matrix_id],
        transaction: transaction,
      }
    )

    // Renumber the taxa position in the matrix is that is monotonically increasing.
    await sequelizeConn.query(
      `
      UPDATE matrix_taxa_order
      SET position=@tmp_position:=@tmp_position+1
      WHERE matrix_id = ? AND (@tmp_position:=0)+1
      ORDER BY position`,
      { replacements: [this.matrix.matrix_id], transaction: transaction }
    )

    await this.logMatrixChange(transaction)

    await transaction.commit()
    return {
      taxa_ids: taxaIds,
    }
  }

  async reorderTaxa(taxaIds, index) {
    if (!taxaIds.length) {
      throw new UserError('No taxa were specified')
    }

    await this.checkCanDo(
      'editCellData',
      'You are not allowed to reorder this matrix'
    )

    const transaction = await sequelizeConn.transaction()

    await sequelizeConn.query(
      `
      UPDATE matrix_taxa_order
      SET position=position + ?
      WHERE matrix_id = ? AND position > ?
      ORDER BY position DESC`,
      {
        replacements: [taxaIds.length, this.matrix.matrix_id, index],
        transaction: transaction,
      }
    )

    await sequelizeConn.query(
      `
      UPDATE matrix_taxa_order
      SET position=@tmp_position:=@tmp_position+1
      WHERE (@tmp_position:=?)+1 AND matrix_id = ? AND taxon_id IN (?)
      ORDER BY position`,
      {
        replacements: [index, this.matrix.matrix_id, taxaIds],
        transaction: transaction,
      }
    )

    await sequelizeConn.query(
      `
      UPDATE matrix_taxa_order
      SET position=@tmp_position:=@tmp_position+1
      WHERE matrix_id = ? AND (@tmp_position:=0)+1
      ORDER BY position`,
      { replacements: [this.matrix.matrix_id], transaction: transaction }
    )

    await this.logMatrixChange(transaction)

    await transaction.commit()
    return {
      taxa_ids: taxaIds,
      index: index,
    }
  }

  async setTaxaNotes(taxaIds, notes) {
    if (!taxaIds.length) {
      throw new UserError('You must specify taxa to modify the notes')
    }

    await this.checkCanDo(
      'editTaxon',
      'You are not allowed to modify taxa in this matrix'
    )
    await this.checkCanEditTaxa(taxaIds)

    const transaction = await sequelizeConn.transaction()

    await models.Taxon.update(
      { notes: notes },
      {
        where: { taxon_id: taxaIds },
        transaction: transaction,
        individualHooks: true,
        user: this.user,
      }
    )

    await transaction.commit()
    return {
      taxa_ids: taxaIds,
      notes: notes,
    }
  }

  async setTaxaAccess(taxaIds, userId, groupId) {
    await this.checkCanDo(
      'editTaxon',
      'You are not allowed to modify taxa in this matrix'
    )

    if (!(await this.isAdminLike())) {
      throw new UserError(
        'You are not allowed to modify one or more of the selected taxa'
      )
    }

    const transaction = await sequelizeConn.transaction()

    await models.MatrixTaxaOrder.update(
      {
        user_id: userId,
        group_id: groupId,
      },
      {
        where: {
          taxon_id: taxaIds,
          matrix_id: this.matrix.matrix_id,
        },
        transaction: transaction,
        individualHooks: true,
        user: this.user,
      }
    )

    await transaction.commit()
    return {
      taxa_ids: taxaIds,
      user_id: userId,
      group_id: groupId,
    }
  }

  async removeTaxonMedia(linkId) {
    await this.checkCanDo(
      'deleteTaxonMedia',
      'You are not allowed to remove media from this taxon'
    )

    const taxaMedia = await models.TaxaXMedium.findByPk(linkId)

    // In the case that the media is no longer affiliated with the taxon, we allow the client to
    // remove it. This may be because another user removed it.
    if (taxaMedia == null) {
      return { link_id: linkId }
    }

    const taxon = await models.Taxon.findByPk(taxaMedia.taxon_id)
    if (taxon == null || taxon.project_id != this.project.project_id) {
      throw new UserError('Taxon is not a part of this project')
    }

    const media = await models.MediaFile.findByPk(taxaMedia.media_id)
    if (media == null || media.project_id != this.project.project_id) {
      throw new UserError('Media is not a part of this project')
    }

    const transaction = await sequelizeConn.transaction()
    await taxaMedia.destroy({
      transaction: transaction,
      individualHooks: true,
      user: this.user,
    })

    await transaction.commit()
    return { link_id: linkId }
  }

  async addTaxonMedia(taxaIds, mediaIds) {
    await this.checkCanEditTaxa(taxaIds)
    const mediaList = await this.getMediaByIds(mediaIds)
    if (mediaList.size != mediaIds.length) {
      throw new UserError(
        'One or more of the media do not belong to the project'
      )
    }

    const transaction = await sequelizeConn.transaction()
    const taxaMedia = []
    const creationTime = time()
    for (const [mediaId, medium] of mediaList) {
      for (const taxonId of taxaIds) {
        const taxaMedium = await models.TaxaXMedium.create(
          {
            taxon_id: taxonId,
            media_id: mediaId,
            user_id: this.user.user_id,
            created_on: creationTime,
          },
          {
            user: this.user,
            transaction: transaction,
          }
        )

        taxaMedia.push({
          link_id: taxaMedium.link_id,
          taxon_id: taxonId,
          media_id: mediaId,
          tiny: getMedia(medium, 'tiny'),
        })
      }
    }

    await transaction.commit()
    return {
      media: taxaMedia,
    }
  }

  async loadTaxaMedia(taxonId, search) {
    const media = []
    const mediaIds = []

    if (search) {
      // TODO(kenzley): Implement search functionality using Elastic Search.
    } else {
      const replacements = [this.project.project_id]
      let clause = ''
      const taxon = await models.Taxon.findByPk(taxonId)
      if (taxon != null) {
        // Instead of searching by a single taxon, we are searching for media
        // belonging to similar taxa which match the genus, species, and
        // subspecies if available. If none are available, let's instead return
        // all media associated with the project.
        const fields = ['subspecific_epithet', 'specific_epithet', 'genus']
        for (const field of fields) {
          const unit = taxon[field]
          if (unit) {
            clause += ` AND t.${field} = ?`
            replacements.push(unit)
          }
        }
      }

      const [rows] = await sequelizeConn.query(
        `
          SELECT
            DISTINCT mf.media_id, mf.media
          FROM media_files mf
          INNER JOIN specimens AS s ON s.specimen_id = mf.specimen_id
          INNER JOIN taxa_x_specimens AS txs ON s.specimen_id = txs.specimen_id
          INNER JOIN taxa AS t ON txs.taxon_id = t.taxon_id
          WHERE mf.project_id = ? AND mf.cataloguing_status = 0 ${clause}
          ORDER BY mf.media_id`,
        { replacements: replacements }
      )
      for (const row of rows) {
        const mediaId = parseInt(row.media_id)
        mediaIds.push(mediaId)
        media.push({
          media_id: mediaId,
          icon: getMedia(row.media, 'icon'),
          tiny: getMedia(row.media, 'tiny'),
        })
      }
    }

    // Sort by the last the time user recently used the media. This ensures
    // that recently used media is at the top of the media grid.
    if (mediaIds.length) {
      const [rows] = await sequelizeConn.query(
        `
        SELECT media_id, MAX(created_on) AS created_on
        FROM cells_x_media
        WHERE matrix_id = ? AND user_id = ? AND media_id IN (?)
        GROUP BY media_id`,
        { replacements: [this.matrix.matrix_id, this.user.user_id, mediaIds] }
      )

      const mediaTimes = new Map()
      for (const row of rows) {
        const mediaId = parseInt(row.media_id)
        const createdOn = parseInt(row.created_on)
        mediaTimes.set(mediaId, createdOn)
      }

      media.sort((a, b) => {
        const aTime = mediaTimes.get(a['media_id']) ?? 0
        const bTime = mediaTimes.get(b['media_id']) ?? 0
        return Math.sign(bTime - aTime)
      })
    }

    return {
      media: media,
    }
  }

  async addCharacter(name, type, index) {
    await this.checkCanDo(
      'addCharacter',
      'You are not allowed to add characters to this matrix'
    )

    if (!name) {
      const date = new Date().toLocaleString('en-us', {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      })
      name = `New character (${date})`
    }

    // This ensures that we only add meristic characters to meristic matrices
    // and vice-versa.
    if ((type === 2) != (this.matrix.type == 1)) {
      const characterType = type === 2 ? 'meristic' : 'categorical'
      const matrixType = this.matrix.type == 1 ? 'meristic' : 'categorical'
      throw new UserError(
        `Unable to add ${characterType} character to ${matrixType}  matrix`
      )
    }

    const transaction = await sequelizeConn.transaction()

    const [[{ maxPosition }]] = await sequelizeConn.query(
      `
      SELECT MAX(position) maxPosition
      FROM matrix_character_order
      WHERE matrix_id = ?`,
      { replacements: [this.matrix.matrix_id], transaction: transaction }
    )

    const position =
      index == null || index < 0 || index > maxPosition
        ? maxPosition + 1
        : index + 1

    const character = await models.Character.create(
      {
        name: name,
        num: position,
        user_id: this.user.user_id,
        project_id: this.project.project_id,
        type: type,
        source: 'HTML5',
      },
      {
        user: this.user,
        transaction: transaction,
      }
    )
    await sequelizeConn.query(
      `
      UPDATE matrix_character_order
      SET position = position + 1
      WHERE  position >= ? AND  matrix_id = ?
      ORDER BY position DESC`,
      {
        replacements: [position, this.matrix.matrix_id],
        transaction: transaction,
      }
    )
    await sequelizeConn.query(
      `
      INSERT INTO matrix_character_order(matrix_id, character_id, position)
      VALUES(?, ?, ?)`,
      {
        replacements: [this.matrix.matrix_id, character.character_id, position],
        transaction: transaction,
      }
    )

    await this.logMatrixChange(transaction)
    await transaction.commit()
    return {
      character: {
        id: character.character_id,
        n: name,
        r: position,
        t: type,
        uid: this.user.user_id,
        last_changed_on: time(),
      },
    }
  }

  async removeCharacters(characterIds) {
    await this.checkCanDo(
      'deleteCharacter',
      'You are not allowed to delete characters'
    )
    if (characterIds.length == 0) {
      throw new UserError('Please specify at least one character')
    }
    await this.checkCanEditCharacters(characterIds)

    const transaction = await sequelizeConn.transaction()

    await models.Cell.destroy({
      where: {
        character_id: characterIds,
        matrix_id: this.matrix.matrix_id,
      },
      transaction: transaction,
      individualHooks: true,
      user: this.user,
    })

    await models.MatrixCharacterOrder.destroy({
      where: {
        character_id: characterIds,
        matrix_id: this.matrix.matrix_id,
      },
      transaction: transaction,
      individualHooks: true,
      user: this.user,
    })

    await sequelizeConn.query(
      `
      UPDATE matrix_character_order
      SET position=@tmp_position:=@tmp_position+1
      WHERE matrix_id = ? AND (@tmp_position:=0)+1
      ORDER BY position`,
      { replacements: [this.matrix.matrix_id], transaction: transaction }
    )

    const [rows] = await sequelizeConn.query(
      `
        SELECT DISTINCT character_id
        FROM matrix_character_order
        WHERE character_id IN (?) AND matrix_id != ?`,
      {
        replacements: [characterIds, this.matrix.matrix_id],
        transaction: transaction,
      }
    )
    const referencedCharacterIds = rows.map((row) => parseInt(row.character_id))
    const unusedCharacterIds = array_difference(
      characterIds,
      referencedCharacterIds
    )
    if (unusedCharacterIds.length) {
      await models.Character.destroy({
        where: {
          character_id: characterIds,
        },
        transaction: transaction,
        individualHooks: true,
        user: this.user,
      })
    }

    await this.logMatrixChange(transaction)
    await transaction.commit()
    return {
      character_ids: characterIds,
    }
  }

  async reorderCharacters(characterIds, index) {
    await this.checkCanDo(
      'reorderCharacters',
      'You are not allowed to reorder characters in this matrix'
    )
    if (characterIds.length == 0) {
      throw new UserError('Please specify at least one character')
    }
    await this.checkCanEditCharacters(characterIds)

    const transaction = await sequelizeConn.transaction()

    await sequelizeConn.query(
      `
      UPDATE matrix_character_order
      SET position = position + ?
      WHERE matrix_id = ? AND position > ?
      ORDER BY position DESC`,
      {
        replacements: [characterIds.length, this.matrix.matrix_id, index],
        transaction: transaction,
      }
    )

    await sequelizeConn.query(
      `
      UPDATE matrix_character_order
      SET position=@tmp_position:=@tmp_position+1
      WHERE (@tmp_position:=?)+1 AND matrix_id = ? AND character_id IN (?)
      ORDER BY position`,
      {
        replacements: [index, this.matrix.matrix_id, characterIds],
        transaction: transaction,
      }
    )

    await sequelizeConn.query(
      `
      UPDATE matrix_character_order
      SET position=@tmp_position:=@tmp_position+1
      WHERE matrix_id = ? AND (@tmp_position:=0)+1
      ORDER BY position`,
      { replacements: [this.matrix.matrix_id], transaction: transaction }
    )

    await this.logMatrixChange(transaction)
    await transaction.commit()
    return {
      success: true,
    }
  }

  async updateCharacter(
    characterId,
    name,
    description,
    isMinorEdit,
    ordering,
    states
  ) {
    await this.checkCanDo(
      'editCharacter',
      'You are not allowed to edit this character in this matrix'
    )

    await this.checkCanEditCharacters([characterId])

    const character = await models.Character.findByPk(characterId)
    const transaction = await sequelizeConn.transaction()
    character.name = name
    character.description = description
    character.ordering = ordering
    character.source = 'HTML5'
    await character.save({
      user: this.user,
      is_minor_edit: isMinorEdit,
      transaction: transaction,
    })

    let deletedStateIds = []
    if (states.length) {
      for (const state of states) {
        let characterState
        if (state.id > 0) {
          characterState = await models.CharacterState.findByPk(state.id)
          if (characterState.character_id != characterId) {
            throw new UserError('State is not part of this character')
          }
        } else {
          characterState = await models.CharacterState.build({
            character_id: characterId,
            user_id: this.user.user_id,
          })
        }
        characterState.num = state.r
        characterState.name = state.n
        await characterState.save({
          user: this.user,
          is_minor_edit: isMinorEdit,
          transaction: transaction,
        })

        // Add the state id to the response so that the client can identify
        // them.
        state.id = parseInt(characterState.state_id)
      }

      // Remove states that exist in database but are not in request.
      const stateIds = states.map((state) => state.id)
      const [rows] = await sequelizeConn.query(
        `
          SELECT DISTINCT state_id
          FROM character_states
          WHERE character_id = ? AND state_id NOT IN (?)`,
        {
          replacements: [characterId, stateIds],
          transaction: transaction,
        }
      )
      deletedStateIds = rows.map((row) => parseInt(row.state_id))
      if (deletedStateIds.length > 0) {
        // TODO(kenzley): Consider moving this into a deletion hook which finds
        //                all referenced tables and deletes them.
        await sequelizeConn.query(
          `
          DELETE FROM media_labels
          WHERE table_num = 16 AND link_id IN
          (
            SELECT link_id
            FROM characters_x_media
            WHERE state_id IN (?)
          )`,
          {
            replacements: [deletedStateIds],
            transaction: transaction,
          }
        )
        await models.CharacterState.destroy({
          where: {
            state_id: deletedStateIds,
          },
          transaction: transaction,
          individualHooks: true,
          user: this.user,
          is_minor_edit: isMinorEdit,
        })
      }
    }

    await transaction.commit()
    return {
      ts: isMinorEdit ? 0 : time(),
      character_id: characterId,
      name: name,
      description: description,
      is_minor_edit: isMinorEdit,
      deleted_state_ids: deletedStateIds,
      states: states,
    }
  }

  async updateCharactersOrdering(characterIds, ordering) {
    await this.checkCanDo(
      'editCharacter',
      'You are not allowed to edit this character in this matrix'
    )

    await this.checkCanEditCharacters(characterIds)
    await this.checkCharactersAreDiscrete(characterIds)

    const transaction = await sequelizeConn.transaction()
    await models.Character.update(
      { ordering: ordering },
      {
        where: { character_id: characterIds },
        transaction: transaction,
        individualHooks: true,
        user: this.user,
      }
    )

    await transaction.commit()
    return {
      character_ids: characterIds,
    }
  }

  async getCharacterCitations(characterId) {
    const [rows] = await sequelizeConn.query(
      `
      SELECT *
      FROM bibliographic_references br
      INNER JOIN characters_x_bibliographic_references AS txbr ON
        txbr.reference_id = br.reference_id
      WHERE txbr.character_id = ?`,
      {
        replacements: [characterId],
      }
    )
    const citations = []
    for (const row of rows) {
      citations.push({
        link_id: row.link_id,
        citation_id: row.reference_id,
        name: getCitationText(row),
        notes: row.notes,
        pp: row.pp,
      })
    }
    return { citations: citations }
  }

  async removeCharacterCitation(linkId) {
    const link = await models.CharactersXBibliographicReference.findByPk(linkId)
    if (link == null) {
      throw new UserError('Citation does not exist')
    }

    await this.checkCanEditCharacters([link.character_id])

    const transaction = await sequelizeConn.transaction()
    await link.destroy({
      transaction: transaction,
      individualHooks: true,
      user: this.user,
    })

    await transaction.commit()
    return {
      link_id: linkId,
    }
  }

  async upsertCharacterCitation(linkId, characterId, citationId, pp, notes) {
    await this.checkCanEditCharacters([characterId])

    const transaction = await sequelizeConn.transaction()
    const [link, built] =
      await models.CharactersXBibliographicReference.findOrBuild({
        where: {
          link_id: linkId,
        },
        defaults: {
          character_id: characterId,
          reference_id: citationId,
          user_id: this.user.user_id,
          pp: pp,
          notes: notes,
          source: 'HTML5',
        },
        user: this.user,
        transaction: transaction,
      })

    let name = null
    if (built) {
      const existingLink =
        await models.CharactersXBibliographicReference.findOne({
          where: {
            character_id: characterId,
            reference_id: citationId,
            pp: pp,
          },
          transaction: transaction,
        })
      if (existingLink != null) {
        throw new UserError(`
          You have already added this citation to this character.
          You can only add a citation to a character once`)
      }
      const citation = await models.BibliographicReference.findByPk(citationId)
      if (citation == null) {
        throw new UserError('Citation is not found')
      }
      name = getCitationText(citation)
    } else {
      // Ensure that the user provided the correct link to the character.
      if (link.character_id != characterId) {
        throw new UserError('Citation does not match the given character')
      }

      link.pp = pp
      link.notes = notes
    }

    await link.save({ user: this.user, transaction: transaction })
    await transaction.commit()
    return {
      citation: {
        link_id: link.link_id,
        citation_id: citationId,
        pp: pp,
        notes: notes,
        name: name,
      },
    }
  }

  // TODO(kenzley): We need to implement this when the search engine is done.
  async findCharacterMedia(search) {
    if (!search) {
      throw new UserError('Character media text cannot be empty')
    }
    const media = []
    return {
      search: search,
      media: media,
    }
  }

  async addCharacterMedia(characterId, stateId, mediaIds) {
    await this.checkCanDo(
      'addCharacterMedia',
      'You are not allowed to add media to this character'
    )

    const isCellMediaAutomationEnabled = this.matrix.getOption(
      'ENABLE_CELL_MEDIA_AUTOMATION'
    )
    const character = await models.Character.findByPk(characterId)
    if (character == null || character.project_id != this.project.project_id) {
      throw new UserError('Character ID was invalid')
    }

    if (stateId != null) {
      const state = await models.CharacterState.findByPk(stateId)
      if (state.character_id != characterId) {
        throw new UserError('State ID was invalid')
      }
    }

    const [rows] = await sequelizeConn.query(
      `
      SELECT cm.media_id
      FROM characters_x_media cm
      INNER JOIN media_files AS m ON m.media_id = cm.media_id
      WHERE cm.character_id = ?`,
      { replacements: [characterId] }
    )
    const existingMediaIds = rows.map((row) => parseInt(row.media_id))

    const newMediaIds = array_difference(mediaIds, existingMediaIds)
    const media = await models.MediaFile.findAll({
      where: { media_id: newMediaIds },
    })

    const transaction = await sequelizeConn.transaction()
    const characterMedia = []
    for (const medium of media) {
      if (medium.project_id != this.project.project_id) {
        throw new UserError('Media does not belong to this project')
      }
      if (isCellMediaAutomationEnabled == 1 && medium.view_id == null) {
        throw new UserError('Character media must have a Media View')
      }

      const characterMedium = await models.CharactersXMedium.create(
        {
          character_id: characterId,
          media_id: medium.media_id,
          state_id: stateId,
          user_id: this.user.user_id,
          source: 'HTML5',
        },
        {
          user: this.user,
          transaction: transaction,
        }
      )

      characterMedia.push({
        link_id: characterMedium.link_id,
        character_id: characterId,
        media_id: medium.media_id,
        state_id: stateId,
        icon: getMedia(medium.media, 'icon'),
        tiny: getMedia(medium.media, 'tiny'),
      })
    }

    await transaction.commit()
    return {
      media: characterMedia,
    }
  }

  async removeCharacterMedia(linkId, characterId, mediaId) {
    await this.checkCanDo(
      'deleteCharacterMedia',
      'You are not allowed to remove media in this character'
    )

    const characterMedium = await models.CharactersXMedium.findByPk(linkId)

    if (characterMedium) {
      await this.checkCanEditCharacters([characterId])
      if (characterMedium.character_id != characterId) {
        throw new UserError(`Character does not match media`)
      }

      if (characterMedium.media_id != mediaId) {
        throw new UserError(`Media is not in character`)
      }

      const transaction = await sequelizeConn.transaction()
      await characterMedium.destroy({
        user: this.user,
        transaction: transaction,
      })
      await transaction.commit()
    }

    return {
      link_id: linkId,
    }
  }

  async moveCharacterMedia(linkId, characterId, stateId, mediaId) {
    await this.checkCanDo(
      'addCharacterMedia',
      'You are not allowed to move media in this character'
    )

    await this.checkCanEditCharacters([characterId])
    const characterMedium = await models.CharactersXMedium.findByPk(linkId)
    if (characterMedium == null) {
      throw new UserError('Character media does not exist')
    }
    if (characterMedium.media_id != mediaId) {
      throw new UserError('Media is invalid')
    }

    if (stateId) {
      const state = await models.CharacterState.findByPk(stateId)
      if (state.character_id != characterId) {
        throw new UserError('Character state is invalid')
      }
    }

    const oldStateId = characterMedium.state_id
    const transaction = await sequelizeConn.transaction()

    characterMedium.state_id = stateId
    characterMedium.source = 'HTML5'
    await characterMedium.save({
      user: this.user,
      transaction: transaction,
    })

    await transaction.commit()
    return {
      link_id: characterMedium.link_id,
      media_id: mediaId,
      character_id: characterId,
      state_id: stateId,
      old_state_id: oldStateId,
    }
  }

  async addCharacterComment(characterId, stateId, text) {
    if (!text) {
      throw new UserError('Comment must not be empty')
    }

    await this.checkCanDo(
      'addCharacterComment',
      'You are not allowed to add commments to this character'
    )

    await this.checkCanEditCharacters([characterId])

    const annotation = models.Annotation.build({
      typecode: 'C',
      annotation: text,
      user_id: this.user.user_id,
    })
    if (stateId) {
      const state = await models.CharacterState.findByPk(stateId)
      if (!state) {
        throw new UserError('State does not exist')
      }
      if (state.character_id != characterId) {
        throw new UserError('State is not associated with this character')
      }
      annotation.table_num = TABLE_NUMBERS.character_states
      annotation.row_id = stateId
    } else {
      annotation.table_num = TABLE_NUMBERS.characters
      annotation.row_id = characterId
    }

    const transaction = await sequelizeConn.transaction()
    await annotation.save({
      user: this.user,
      transaction: transaction,
    })
    await transaction.commit()

    return {
      character_id: characterId,
      state_id: stateId,
      comment_text: text,
    }
  }

  async getCharacterComments(characterId) {
    const [characterCommentRows] = await sequelizeConn.query(
      `
      SELECT
        a.annotation_id, a.annotation, a.created_on,
        wu.user_id, wu.fname, wu.lname, wu.email
      FROM annotations a
      INNER JOIN ca_users AS wu ON wu.user_id = a.user_id
      WHERE
        table_num = ? AND row_id = ? AND typecode = 'C'
      ORDER BY
        a.created_on ASC`,
      { replacements: [TABLE_NUMBERS.characters, characterId] }
    )

    const [stateCommentsRows] = await sequelizeConn.query(
      `
      SELECT
        a.annotation_id, a.annotation, a.created_on,
        wu.user_id, wu.fname, wu.lname, wu.email,
        c.character_id, c.name character_name,
        cs.state_id, cs.name state_name, cs.num state_num
      FROM characters c
      INNER JOIN character_states AS cs ON c.character_id = cs.character_id
      INNER JOIN annotations AS a ON a.row_id = cs.state_id
      INNER JOIN ca_users AS wu ON wu.user_id = a.user_id
      WHERE a.table_num = ? AND c.character_id = ?`,
      { replacements: [TABLE_NUMBERS.character_states, characterId] }
    )

    const rows = [...characterCommentRows, ...stateCommentsRows]

    const createdTime = time()
    const comments = []
    const annotationEvents = []
    for (const row of rows) {
      const annotationId = parseInt(row.annotation_id)
      const statename = row.state_id
        ? `[${row.state_num}] ${row.state_name}`
        : 'character'
      const user = `${row.fname} ${row.lname} (${row.email})`
      comments.push({
        id: annotationId,
        created_on: row.created_on,
        user: user,
        statename: statename,
        comment: row.annotation,
      })
      annotationEvents.push({
        annotation_id: annotationId,
        typecode: 0,
        date_time: createdTime,
        user_id: this.user.user_id,
      })
    }
    comments.sort((a, b) => a.created_on - b.created_on)

    // Add an event to indicate that we read the comments.
    const transaction = await sequelizeConn.transaction()
    await models.AnnotationEvent.bulkCreate(annotationEvents, {
      user: this.user,
      transaction: transaction,
      updateOnDuplicate: ['date_time'],
    })
    await transaction.commit()

    return {
      comments: comments,
    }
  }

  async setCharacterCommentsAsUnread(characterId) {
    const [rows] = await sequelizeConn.query(
      `
      SELECT annotation_id
      FROM annotations
      WHERE table_num = ? AND row_id = ? AND typecode = 'C'
      UNION
      SELECT annotation_id
      FROM annotations AS a
      INNER JOIN character_states AS cs ON cs.state_id = a.row_id
      INNER JOIN characters AS c ON c.character_id = cs.character_id
      WHERE a.table_num = ? AND c.character_id = ? AND typecode = 'C'`,
      {
        replacements: [
          TABLE_NUMBERS.characters,
          characterId,
          TABLE_NUMBERS.character_states,
          characterId,
        ],
      }
    )
    const annotationIds = rows.map((row) => parseInt(row.annotation_id))
    const transaction = await sequelizeConn.transaction()
    await models.AnnotationEvent.destroy({
      where: {
        user_id: this.user.user_id,
        annotation_id: annotationIds,
      },
      transaction: transaction,
      individualHooks: true,
      user: this.user,
    })
    await transaction.commit()
    return {
      character_id: characterId,
    }
  }

  async addCharacterRuleAction(
    characterId,
    stateId,
    actionCharacterIds,
    actionStateId,
    action
  ) {
    // Since adding an ontology rule may modify cell scores or media, ensure
    // that the user has access to edit the cell data.
    await this.checkCanDo(
      'editCellData',
      'You are not allowed to add ontologies to this matrix'
    )

    // Ensure that if multiple action characters are defined, the given action
    // state id is inapplicable.
    if (actionStateId && actionCharacterIds.length > 1) {
      throw new UserError('You cannot add one state for numerous characters')
    }

    if (stateId) {
      const state = await models.CharacterState.findByPk(stateId)
      if (state == null || state.character_id != characterId) {
        throw new UserError('Invalid state for character')
      }
    }

    if (actionStateId) {
      const state = await models.CharacterState.findByPk(actionStateId)
      if (state == null || state.character_id != actionCharacterIds[0]) {
        throw new UserError('Invalid state for action character')
      }
    }

    const transaction = await sequelizeConn.transaction()
    const [characterRule] = await models.CharacterRule.findOrCreate({
      where: {
        character_id: characterId,
        state_id: stateId,
      },
      defaults: {
        character_id: characterId,
        state_id: stateId,
        user_id: this.user.user_id,
        created_on: time(),
        source: 'HTML5',
      },
      transaction: transaction,
      user: this.user,
    })

    const actionIds = []
    for (const actionCharacterId of actionCharacterIds) {
      const [rule, created] = await models.CharacterRuleAction.findOrCreate({
        where: {
          rule_id: characterRule.rule_id,
          character_id: actionCharacterId,
          action: action,
        },
        defaults: {
          rule_id: characterRule.rule_id,
          character_id: actionCharacterId,
          action: action,
          state_id: actionStateId,
          user_id: this.user.user_id,
        },
        transaction: transaction,
        user: this.user,
      })

      if (!created) {
        rule.state_id = actionStateId
        await rule.save({ user: this.user, transaction: transaction })
      }

      const actionId = parseInt(rule.action_id)
      actionIds.push(actionId)
    }

    await transaction.commit()
    return {
      ads: actionIds,
      a: action,
      cd: characterId,
      sd: stateId,
      acds: actionCharacterIds,
      asd: actionStateId,
    }
  }

  async removeCharacterRuleAction(characterId, actionId) {
    // Since adding an ontology rule may modify cell scores or media, ensure
    // that the user has access to edit the cell data.
    await this.checkCanDo(
      'editCellData',
      'You are not allowed to remove ontologies to this matrix'
    )

    const character = await models.Character.findByPk(characterId)
    if (character == null) {
      throw new UserError('The character does not exist')
    }
    if (character.project_id != this.project.project_id) {
      throw new UserError('This character does not belong to this project')
    }

    const action = await models.CharacterRuleAction.findByPk(actionId)
    if (action) {
      const transaction = await sequelizeConn.transaction()
      const rule = await models.CharacterRule.findByPk(action.rule_id)
      if (rule.character_id != characterId) {
        throw new UserError('This action does not belong to this character')
      }
      await action.destroy({ user: this.user, transaction: transaction })

      // If there are no other linked actions. Let's also delete the rule.
      const [[{ count }]] = await sequelizeConn.query(
        'SELECT COUNT(*) count FROM character_rule_actions WHERE rule_id = ?',
        { replacements: [action.rule_id], transaction: transaction }
      )
      if (count == 0) {
        await rule.destroy({ user: this.user, transaction: transaction })
      }
      await transaction.commit()
    }

    return {
      action_id: actionId,
      character_id: characterId,
    }
  }

  async getRuleViolations() {
    const violations = []

    const [stateViolationsRows] = await sequelizeConn.query(
      `
      SELECT
        cra.action_id, ca.taxon_id, cr.character_id AS rule_character_id,
      cra.character_id AS action_character_id, cra.state_id
      FROM matrix_character_order AS mco
      INNER JOIN character_rules AS cr ON
        cr.character_id = mco.character_id
      INNER JOIN cells AS c ON
        c.matrix_id = mco.matrix_id AND
        c.character_id = cr.character_id AND
        c.state_id = cr.state_id
      INNER JOIN matrix_taxa_order AS mto ON
        mto.taxon_id = c.taxon_id AND
        mto.matrix_id = mco.matrix_id
      INNER JOIN character_rule_actions AS cra ON
        cra.rule_id = cr.rule_id AND
        cra.action = 'SET_STATE'
      INNER JOIN matrix_character_order AS mcoa ON
        mcoa.character_id = cra.character_id AND
        mcoa.matrix_id = mco.matrix_id
      LEFT JOIN cells AS ca ON
        ca.matrix_id = mcoa.matrix_id AND
        ca.character_id = cra.character_id AND
        ca.taxon_id = c.taxon_id
      WHERE
        mco.matrix_id = ? AND NOT ca.state_id <=> cra.state_id
      ORDER BY
        mcoa.position, mto.position`,
      { replacements: [this.matrix.matrix_id] }
    )
    for (const row of stateViolationsRows) {
      violations.push({
        aid: parseInt(row.action_id),
        tid: parseInt(row.taxon_id),
        rcid: parseInt(row.rule_character_id),
        acid: parseInt(row.action_character_id),
        sid: row.state_id == null ? 0 : parseInt(row.state_id),
      })
    }

    const [mediaViolationsRows] = await sequelizeConn.query(
      `
      SELECT
        cra.action_id, cxm.taxon_id, cr.character_id AS rule_character_id,
      cra.character_id AS action_character_id, cra.state_id
      FROM matrix_character_order AS mco
      INNER JOIN character_rules AS cr ON
        cr.character_id = mco.character_id
      INNER JOIN cells_x_media AS cxm ON
        cxm.character_id = mco.character_id AND
        cxm.matrix_id = mco.matrix_id
      INNER JOIN matrix_taxa_order AS mto ON
        mto.matrix_id = mco.matrix_id AND
        mto.taxon_id = cxm.taxon_id
      INNER JOIN character_rule_actions AS cra ON
        cra.rule_id = cr.rule_id AND
        cra.action = 'ADD_MEDIA'
      INNER JOIN matrix_character_order AS mcoa ON
        mcoa.character_id = cra.character_id AND
        mcoa.matrix_id = mco.matrix_id
      LEFT JOIN cells_x_media AS cxma ON
        cxma.character_id = mcoa.character_id AND
        cxma.matrix_id = mcoa.matrix_id AND
        cxma.media_id = cxm.media_id AND
        cxma.taxon_id = cxm.taxon_id
      WHERE
        mco.matrix_id = ? AND cxma.media_id IS NULL
      ORDER BY
        mcoa.position, mto.position`,
      { replacements: [this.matrix.matrix_id] }
    )
    for (const row of mediaViolationsRows) {
      violations.push({
        aid: parseInt(row.action_id),
        tid: parseInt(row.taxon_id),
        rcid: parseInt(row.rule_character_id),
        acid: parseInt(row.action_character_id),
        sid: row.state_id == null ? 0 : parseInt(row.state_id),
      })
    }

    return {
      violations: violations,
    }
  }

  async fixRuleViolations(violations) {
    await this.checkCanDo(
      'editCellData',
      'You are not allowed to modify cells this matrix'
    )

    const replacements = []

    const taxaIds = []
    const actionIds = []
    const clauses = []
    for (const violation of violations) {
      const taxonId = parseInt(violation.tid)
      const actionId = parseInt(violation.aid)
      taxaIds.push(taxonId)
      actionIds.push(actionId)
      clauses.push('(cra.action_id = ? AND cxm.taxon_id = ?)')
      replacements.push(actionId, taxonId)
    }

    await this.checkCanEditTaxa(taxaIds)

    const characterRuleActions = new Map()
    const [rulesRows] = await sequelizeConn.query(
      `
        SELECT
          cra.action_id, cra.character_id, cra.state_id, cra.action
        FROM matrix_character_order AS mco
        INNER JOIN character_rules AS cr ON
          cr.character_id = mco.character_id
        INNER JOIN character_rule_actions AS cra ON
          cra.rule_id = cr.rule_id
        INNER JOIN matrix_character_order AS mcoa ON
          mcoa.character_id = cra.character_id AND
          mcoa.matrix_id = mco.matrix_id
        WHERE mco.matrix_id = ? AND cra.action_id IN (?)`,
      {
        replacements: [this.matrix.matrix_id, actionIds],
      }
    )
    for (const row of rulesRows) {
      const actionId = parseInt(row.action_id)
      characterRuleActions.set(actionId, {
        character_id: parseInt(row.character_id),
        state_id: row.state_id ? parseInt(row.state_id) : null,
        action: row.action,
      })
    }

    const [mediaRows] = await sequelizeConn.query(
      `
      SELECT
        cra.action_id, cra.action, cxm.taxon_id, cra.character_id, cxm.media_id,
        m.media
      FROM matrix_character_order AS mco
      INNER JOIN character_rules AS cr ON
        cr.character_id = mco.character_id
      INNER JOIN cells_x_media AS cxm ON
        cxm.character_id = mco.character_id AND
        cxm.matrix_id = mco.matrix_id
      INNER JOIN matrix_taxa_order AS mto ON
        mto.matrix_id = mco.matrix_id AND
        mto.taxon_id = cxm.taxon_id
      INNER JOIN character_rule_actions AS cra ON
        cra.rule_id = cr.rule_id
      INNER JOIN matrix_character_order AS mcoa ON
        mcoa.character_id = cra.character_id AND
        mcoa.matrix_id = mco.matrix_id
      LEFT JOIN cells_x_media AS cxma ON
        cxma.character_id = mcoa.character_id AND
        cxma.matrix_id = mcoa.matrix_id AND
        cxma.media_id = cxm.media_id AND
        cxma.taxon_id = cxm.taxon_id
      INNER JOIN media_files AS m ON
        m.media_id = cxm.media_id
      WHERE
        mco.matrix_id = ? AND
        cra.action = 'ADD_MEDIA' AND
        cxma.media_id IS NULL AND (${clauses.join('OR')})`,
      { replacements: [this.matrix.matrix_id, ...replacements] }
    )
    for (const row of mediaRows) {
      const actionId = parseInt(row.action_id)
      const characterRuleAction = characterRuleActions.get(actionId)
      characterRuleAction.media_id = parseInt(row.media_id)
      characterRuleAction.icon = getMedia(row.media, 'icon')
      characterRuleAction.tiny = getMedia(row.media, 'tiny')
    }

    const transaction = await sequelizeConn.transaction()

    // The results from the violation fixes for cells and media
    const changedCells = []
    const changedMedia = []

    for (const violation of violations) {
      const taxonId = parseInt(violation.tid)
      const actionId = parseInt(violation.aid)
      const characterRuleAction = characterRuleActions.get(actionId)
      const characterId = characterRuleAction['character_id']
      switch (characterRuleAction['action']) {
        case 'SET_STATE': {
          await models.Cell.destroy({
            where: {
              matrix_id: this.matrix.matrix_id,
              character_id: characterId,
              taxon_id: taxonId,
            },
            transaction: transaction,
            individualHooks: true,
            user: this.user,
          })

          const stateId = characterRuleAction['state_id']
          const cell = await models.Cell.create(
            {
              matrix_id: this.matrix.matrix_id,
              taxon_id: taxonId,
              character_id: characterId,
              user_id: this.user.user_id,
              state_id: stateId > 0 ? stateId : null,
            },
            { user: this.user, transaction: transaction }
          )
          changedCells.push(cell)
          break
        }
        case 'ADD_MEDIA': {
          const mediaId = characterRuleAction['media_id']

          const cellMedium = await models.CellsXMedium.create(
            {
              matrix_id: this.matrix.matrix_id,
              taxon_id: taxonId,
              character_id: characterId,
              media_id: mediaId,
              user_id: this.user.user_id,
              source: 'HTML5',
            },
            { user: this.user, transaction: transaction }
          )

          changedMedia.push({
            link_id: parseInt(cellMedium.link_id),
            character_id: characterId,
            taxon_id: taxonId,
            media_id: mediaId,
            icon: characterRuleAction.icon,
            tiny: characterRuleAction.tiny,
          })
          break
        }
        default:
          await transaction.rollback()
          throw new UserError('Unknown character rule action')
      }
    }

    await transaction.commit()
    return {
      ts: time(),
      cells: await this.convertCellQueryToResults(changedCells),
      media: changedMedia,
    }
  }

  async fixAllRuleViolations() {
    await this.checkCanDo(
      'editCellData',
      'You are not allowed to modify cells this matrix'
    )

    const [allowedTaxaRows] = await sequelizeConn.query(
      `
      SELECT mto.taxon_id
      FROM matrix_taxa_order mto
      INNER JOIN matrices AS m ON
        m.matrix_id = mto.matrix_id
      INNER JOIN projects_x_users AS pxu ON
        pxu.project_id = m.project_id
      LEFT JOIN project_members_x_groups AS pmxg ON
        pmxg.membership_id = pxu.link_id
      WHERE
        m.matrix_id = ? AND pxu.user_id = ? AND
      (mto.group_id = pmxg.group_id OR mto.group_id IS NULL OR mto.user_id IS NULL OR mto.user_id = ?)`,
      {
        replacements: [
          this.matrix.matrix_id,
          this.user.user_id,
          this.user.user_id,
        ],
      }
    )
    if (allowedTaxaRows.length == 0) {
      throw new UserError(
        'You are not allowed to modify any of the taxa in this matrix'
      )
    }
    const allowedTaxaIds = []
    for (const row of allowedTaxaRows) {
      allowedTaxaIds.push(parseInt(row.taxon_id))
    }

    const [stateRows] = await sequelizeConn.query(
      `
      SELECT
        c.taxon_id, cra.character_id, cra.state_id
      FROM matrix_character_order AS mco
      INNER JOIN character_rules AS cr ON
        cr.character_id = mco.character_id
      INNER JOIN cells AS c ON
        c.matrix_id = mco.matrix_id AND
        c.character_id = cr.character_id AND
        c.state_id = cr.state_id
      INNER JOIN matrix_taxa_order AS mto ON
        mto.taxon_id = c.taxon_id AND
        mto.matrix_id = mco.matrix_id
      INNER JOIN character_rule_actions AS cra ON
        cra.rule_id = cr.rule_id AND
        cra.action = 'SET_STATE'
      INNER JOIN matrix_character_order AS mcoa ON
        mcoa.character_id = cra.character_id AND
        mcoa.matrix_id = mco.matrix_id
      LEFT JOIN cells AS ca ON
        ca.matrix_id = mcoa.matrix_id AND
        ca.character_id = cra.character_id AND
        ca.taxon_id = c.taxon_id
      WHERE
        mco.matrix_id = ? AND
        ca.state_id != cra.state_id AND
        c.taxon_id IN (?)`,
      {
        replacements: [this.matrix.matrix_id, allowedTaxaIds],
      }
    )

    const transaction = await sequelizeConn.transaction()

    const changedCells = []
    for (const row of stateRows) {
      const characterId = parseInt(row.character_id)
      const taxonId = parseInt(row.taxon_id)
      await models.Cell.destroy({
        where: {
          matrix_id: this.matrix.matrix_id,
          character_id: characterId,
          taxon_id: taxonId,
        },
        individualHooks: true,
        user: this.user,
        transaction: transaction,
      })

      const stateId = row.state_id
      const cell = await models.Cell.create(
        {
          matrix_id: this.matrix.matrix_id,
          taxon_id: taxonId,
          character_id: characterId,
          user_id: this.user.user_id,
          state_id: stateId > 0 ? stateId : null,
        },
        { user: this.user, transaction: transaction }
      )
      changedCells.push(cell)
    }

    const [mediaRows] = await sequelizeConn.query(
      `
      SELECT
        cxm.taxon_id, cra.character_id, cxm.media_id, m.media
      FROM matrix_character_order AS mco
      INNER JOIN character_rules AS cr ON
        mco.character_id = cr.character_id
      INNER JOIN cells_x_media AS cxm ON
        cxm.character_id = mco.character_id AND
        cxm.matrix_id = mco.matrix_id
      INNER JOIN matrix_taxa_order AS mto ON
        mto.matrix_id = mco.matrix_id AND
        mto.taxon_id = cxm.taxon_id
      INNER JOIN character_rule_actions AS cra ON
        cra.rule_id = cr.rule_id AND
        cra.action = 'ADD_MEDIA'
      INNER JOIN matrix_character_order AS mcoa ON
        cra.character_id = mcoa.character_id AND
        mcoa.matrix_id = mco.matrix_id
      LEFT JOIN cells_x_media AS cxma ON
        cxma.character_id = mcoa.character_id AND
        cxma.matrix_id = mcoa.matrix_id AND
        cxma.media_id = cxm.media_id AND
        cxma.taxon_id = cxm.taxon_id
      INNER JOIN media_files AS m ON
        m.media_id = cxm.media_id
      WHERE
        mco.matrix_id = ? AND
        cxma.media_id IS NULL AND
        cxm.taxon_id IN (?)
      ORDER BY
        mcoa.position, mto.position`,
      {
        replacements: [this.matrix.matrix_id, allowedTaxaIds],
      }
    )
    const changedMedia = []
    for (const row of mediaRows) {
      const characterId = parseInt(row.character_id)
      const taxonId = parseInt(row.taxon_id)
      const mediaId = parseInt(row.media_id)

      const cellMedium = await models.CellsXMedium.create(
        {
          matrix_id: this.matrix.matrix_id,
          taxon_id: taxonId,
          character_id: characterId,
          media_id: mediaId,
          user_id: this.user.user_id,
          source: 'HTML5',
        },
        { user: this.user, transaction: transaction }
      )

      changedMedia.push({
        link_id: parseInt(cellMedium.link_id),
        character_id: characterId,
        taxon_id: taxonId,
        media_id: mediaId,
        icon: getMedia(row.media, 'icon'),
        tiny: getMedia(row.media, 'tiny'),
      })
    }

    await transaction.commit()
    return {
      ts: time(),
      cells: await this.convertCellQueryToResults(changedCells),
      media: changedMedia,
    }
  }

  async getCharacterChanges(characterId) {
    const character = await models.Character.findByPk(characterId)
    if (character == null || character.project_id != this.project.project_id) {
      throw new UserError('Character is not associated with this project')
    }

    const logs = []

    // TODO: Implement this when the datamodel is completed.

    return { logs }
  }

  async setCellStates(taxaIds, characterIds, stateIds, options) {
    if (taxaIds.length == 0) {
      throw new UserError('Please specify at least one taxon')
    }

    if (characterIds.length == 0) {
      throw new UserError('Please specify at least one character')
    }

    if (this.matrix.getOption('DISABLE_SCORING')) {
      throw new UserError(
        'Scoring has been disabled by the project administrator'
      )
    }

    await this.checkCanDo(
      'editCellData',
      'You are not allowed to set states in this matrix'
    )
    await this.checkCanEditTaxa(taxaIds)
    await this.checkCanEditCharacters(characterIds)

    const batchMode = options != null && parseInt(options['batchmode'])
    const uncertain = options != null && !!options['uncertain']

    // Check for valid state combinations for uncertain scores. This disallow
    // setting "NPA" along with additional states. "NPA" are should be the only
    // selected state in a cell score.
    if (stateIds.length > 1 && stateIds.includes(-1 /* NPA */)) {
      throw new UserError('Invalid state combination for cells')
    }

    // Ensure that single cells must be polymorphic and cannot be uncertain.
    if (uncertain && stateIds.length <= 1) {
      throw new UserError('Single cells cannot be uncertain')
    }

    // Ensure that sells cannot be uncertain and include the "NPA" score.
    if (uncertain && stateIds.includes(-1 /* NPA */)) {
      throw new UserError(
        'Uncertain cells not include "NPA" and additional states'
      )
    }

    // Ensure that when multiple charactes are requested, the state ids are not
    // character-specific but instead applicable to all charcaters.
    if (characterIds.length > 1) {
      if (stateIds.length > 1) {
        throw new UserError('Invalid state combination for multiple characters')
      }
      if (stateIds.length == 1 && stateIds[0] > 0) {
        throw new UserError(
          'Cannot set a specific state for multiple characters'
        )
      }
    } else {
      const characterId = parseInt(characterIds[0])
      const characterStateIds = await getStatesIdsForCharacter(characterId)
      const allStateIds = [-1, 0, ...characterStateIds]
      const invalidStateIds = stateIds.filter((i) => !allStateIds.includes(i))
      if (invalidStateIds.length) {
        throw new UserError('Invalid state ID  for character')
      }
    }

    if (stateIds.length) {
      await this.checkCanEditCharacters(characterIds)
    }

    const transaction = await sequelizeConn.transaction()

    let cellBatch
    if (batchMode) {
      cellBatch = models.CellBatchLog.build({
        user_id: this.user.user_id,
        matrix_id: this.matrix.matrix_id,
        batch_type: CELL_BATCH_TYPES.MEDIA_BATCH_SET_SCORE,
        started_on: time(),
      })
    }

    const insertedScores = []
    const cellChangesResults = []
    const allCellScores = await this.getCellsStates(taxaIds, characterIds)
    for (const characterId of characterIds) {
      for (const taxonId of taxaIds) {
        let cellScores = allCellScores.get(taxonId, characterId)
        if (cellScores == null) {
          cellScores = new Map()
        }

        const cellScoresIds = Array.from(cellScores.keys())
        const scoresIdsToDelete = array_difference(cellScoresIds, stateIds)
        const scoresIdsToInsert = array_difference(stateIds, cellScoresIds)
        const unchangedScoreIds = array_intersect(cellScoresIds, stateIds)

        // Determine whether we need to update the uncertainity.
        for (const scoresId of unchangedScoreIds) {
          const cellScore = cellScores.get(scoresId)
          if (cellScore.is_uncertain != uncertain) {
            await models.Cell.update(
              { is_uncertain: uncertain },
              {
                where: { cell_id: cellScore.cell_id },
                transaction: transaction,
                individualHooks: true,
                user: this.user,
              }
            )
            // Update the in-memory record so that it matches what's in the
            // database.
            cellScore.is_uncertain = uncertain
          }
          cellChangesResults.push(cellScore)
        }

        for (const scoresId of scoresIdsToDelete) {
          const cellScore = cellScores.get(scoresId)
          await models.Cell.destroy({
            where: { cell_id: cellScore.cell_id },
            transaction: transaction,
            individualHooks: true,
            user: this.user,
          })
          cellScore.cell_id = 0 // Signal that the cell should be deleted.
          cellChangesResults.push(cellScore)
        }

        for (const scoreId of scoresIdsToInsert) {
          const cell = await models.Cell.create(
            {
              matrix_id: this.matrix.matrix_id,
              taxon_id: taxonId,
              character_id: characterId,
              user_id: this.user.user_id,
              state_id: scoreId > 0 ? scoreId : null,
              is_npa: scoreId == -1 ? 1 : 0,
              is_uncertain: uncertain,
              start_value: null,
              end_value: null,
            },
            { user: this.user, transaction: transaction }
          )
          cellChangesResults.push(cell)
          insertedScores.push(cell)
        }
      }
    }

    if (this.matrix.getOption('APPLY_CHARACTERS_WHILE_SCORING') == 1) {
      const scores = await this.applyStateRules(insertedScores)
      cellChangesResults.push(...scores)
    }

    const deletedCellMedia =
      this.matrix.getOption('ENABLE_CELL_MEDIA_AUTOMATION') == 1
        ? await this.cellMediaToDeleteFromCharacterView(taxaIds, characterIds)
        : []
    if (deletedCellMedia.length > 0) {
      const linkIds = deletedCellMedia.map((media) => parseInt(media.link_id))
      await models.CellsXMedium.destroy({
        where: {
          where: { link_id: linkIds },
          transaction: transaction,
          individualHooks: true,
          user: this.user,
        },
      })
    }

    if (batchMode) {
      let description
      if (batchMode == 2) {
        const character = await models.Character.findByPk(characterIds[0])
        description = `Batch scoring added to ${taxaIds.length} taxa in ${character.name} column`
      } else if (batchMode == 1) {
        const taxon = await models.Taxon.findByPk(taxaIds[0])
        description = `Batch scoring added to ${
          characterIds.length
        } characters in ${getTaxonName(taxon)} row`
      } else {
        throw new UserError('Unable batch mode')
      }

      cellBatch.finished_on = time()
      cellBatch.description = description
      await cellBatch.save({ user: this.user, transaction: transaction })
    }

    await transaction.commit()
    return {
      ts: time(),
      cells: await this.convertCellQueryToResults(cellChangesResults),
      deleted_cell_media: deletedCellMedia,
    }
  }

  async setCellContinuousValues(
    taxaIds,
    characterIds,
    startValue,
    endValue,
    options
  ) {
    if (taxaIds.length == 0) {
      throw new UserError('Please specify at least one taxon')
    }

    if (characterIds.length == 0) {
      throw new UserError('Please specify at least one character')
    }

    if (isNaN(startValue)) {
      throw new UserError('Start value is not a number')
    }

    if (isNaN(endValue)) {
      throw new UserError('End value is not a number')
    }

    if (this.matrix.getOption('DISABLE_SCORING')) {
      throw new UserError(
        'Scoring has been disabled by the project administrator'
      )
    }

    await this.checkCanDo(
      'editCellData',
      'You are not allowed to set states in this matrix'
    )
    await this.checkCanEditTaxa(taxaIds)
    await this.checkCanEditCharacters(characterIds)
    await this.checkCharactersAreNumeric(characterIds)

    const batchMode = options != null && parseInt(options['batchmode'])

    const shouldDelete = startValue === null && endValue === null

    const transaction = await sequelizeConn.transaction()

    let cellBatch
    if (batchMode) {
      cellBatch = models.CellBatchLog.build({
        user_id: this.user.user_id,
        matrix_id: this.matrix.matrix_id,
        batch_type: CELL_BATCH_TYPES.MEDIA_BATCH_SET_SCORE,
        started_on: time(),
      })
    }

    const cellChangesResults = []
    const allCellScores = await this.getCellsStates(taxaIds, characterIds)
    for (const characterId of characterIds) {
      for (const taxonId of taxaIds) {
        const cellScores = allCellScores.get(taxonId, characterId)
        if (cellScores == null && !shouldDelete) {
          const cell = await models.Cell.create(
            {
              matrix_id: this.matrix.matrix_id,
              taxon_id: taxonId,
              character_id: characterId,
              user_id: this.user.user_id,
              state_id: null,
              is_npa: 0,
              is_uncertain: 0,
              start_value: startValue,
              end_value: endValue,
            },
            { user: this.user, transaction: transaction }
          )
          cellChangesResults.push(cell)
        } else if (cellScores.size > 1) {
          throw UserError('Selected Continuous scores have more than one value')
        } else if (shouldDelete) {
          const cellScore = cellScores.get(0)
          await models.Cell.destroy({
            where: { cell_id: cellScore.cell_id },
            user: this.user,
            transaction: transaction,
          })
          cellScore.cell_id = 0 // Signal that the cell should be deleted.
          cellChangesResults.push(cellScore)
        } else {
          const cellScore = cellScores.get(0)
          const cell = await models.Cell.findByPk(cellScore.cell_id)
          cell.start_value = startValue
          cell.end_value = endValue
          cell.user_id = this.user.user_id
          await cell.save({ user: this.user, transaction: transaction })
          cellChangesResults.push(cell)
        }
      }
    }

    if (batchMode) {
      let description
      if (batchMode == 2) {
        const character = await models.Character.findByPk(characterIds[0])
        description = `Batch scoring added to ${taxaIds.length} taxa in ${character.name} column`
      } else if (batchMode == 1) {
        const taxon = await models.Taxon.findByPk(taxaIds[0])
        description = `Batch scoring added to ${
          characterIds.length
        } characters in ${getTaxonName(taxon)} row`
      } else {
        throw new UserError('Unable batch mode')
      }

      cellBatch.finished_on = time()
      cellBatch.description = description
      await cellBatch.save({ user: this.user, transaction: transaction })
    }

    await transaction.commit()
    return {
      ts: time(),
      cells: await this.convertCellQueryToResults(cellChangesResults),
    }
  }

  async setCellNotes(taxaIds, characterIds, notes, status, batchMode) {
    if (taxaIds.length == 0) {
      throw new UserError('Please specify at least one taxon')
    }

    if (characterIds.length == 0) {
      throw new UserError('Please specify at least one character')
    }

    await this.checkCanDo(
      'editCellData',
      'You are not allowed to set states in this matrix'
    )
    await this.checkCanEditTaxa(taxaIds)
    await this.checkCanEditCharacters(characterIds)

    const transaction = await sequelizeConn.transaction()

    let cellBatch
    if (batchMode) {
      cellBatch = models.CellBatchLog.build({
        user_id: this.user.user_id,
        matrix_id: this.matrix.matrix_id,
        batch_type: CELL_BATCH_TYPES.CELL_BATCH_NOTES,
        started_on: time(),
      })
    }

    for (const taxonId of taxaIds) {
      for (const characterId of characterIds) {
        const [cellNote] = await models.CellNote.findOrBuild({
          where: {
            matrix_id: this.matrix.matrix_id,
            taxon_id: taxonId,
            character_id: characterId,
          },
          defaults: {
            matrix_id: this.matrix.matrix_id,
            taxon_id: taxonId,
            character_id: characterId,
            user_id: this.user.user_id,
            status: 0,
            notes: '',
            source: 'HTML5',
          },
          user: this.user,
          transaction: transaction,
        })
        if (notes != null) {
          cellNote.notes = notes.trim()
        }
        if (status) {
          cellNote.status = status
        }
        cellNote.user_id = this.user.user_id
        await cellNote.save({ user: this.user, transaction: transaction })
      }
    }

    if (batchMode) {
      let description
      if (batchMode == 2) {
        const character = await models.Character.findByPk(characterIds[0])
        description = `Updated notes on ${character.name} column`
      } else if (batchMode == 1) {
        const taxon = await models.Taxon.findByPk(taxaIds[0])
        description = `Updated notes on ${getTaxonName(taxon)} row`
      } else {
        throw new UserError('Unable batch mode')
      }

      cellBatch.finished_on = time()
      cellBatch.description = description
      await cellBatch.save({ user: this.user, transaction: transaction })
    }

    await transaction.commit()
    return {
      ts: time(),
      character_ids: characterIds,
      taxa_ids: taxaIds,
      notes: notes,
      status: status,
    }
  }

  async addCellComment(taxonId, characterId, text) {
    await this.checkCanDo(
      'addCellComment',
      'You are not allowed to add comments to this matrix'
    )

    await this.checkCanEditTaxa([taxonId])
    await this.checkCanEditCharacters([characterId])

    if (!text) {
      throw new UserError('Comment must not be empty')
    }

    const annotation = models.Annotation.build({
      typecode: 'C',
      annotation: text,
      user_id: this.user.user_id,
      table_num: TABLE_NUMBERS.matrices,
      row_id: this.matrix.matrix_id,
      specifier_id: characterId,
      subspecifier_id: taxonId,
    })

    const transaction = await sequelizeConn.transaction()
    await annotation.save({
      user: this.user,
      transaction: transaction,
    })
    await transaction.commit()

    return {
      comment: {
        taxon_id: taxonId,
        character_id: characterId,
        comment: text,
      },
    }
  }

  async getCellComments(taxonId, characterId) {
    const [rows] = await sequelizeConn.query(
      `
      SELECT
        a.annotation_id, a.annotation, a.created_on,
        wu.user_id, wu.fname, wu.lname, wu.email
      FROM annotations a
      INNER JOIN ca_users AS wu ON wu.user_id = a.user_id
      WHERE
        table_num = ? AND 
        row_id = ? AND 
        specifier_id = ? AND 
        subspecifier_id = ? AND 
        typecode = 'C'
      ORDER BY
        a.created_on ASC`,
      {
        replacements: [
          TABLE_NUMBERS.matrices,
          this.matrix.matrix_id,
          characterId,
          taxonId,
        ],
      }
    )

    const createdTime = time()
    const comments = []
    const annotationEvents = []
    for (const row of rows) {
      const annotationId = parseInt(row.annotation_id)
      const user = `${row.fname} ${row.lname} (${row.email})`
      comments.push({
        date: row.created_on,
        user: user,
        comment: row.annotation,
      })
      annotationEvents.push({
        annotation_id: annotationId,
        typecode: 0,
        date_time: createdTime,
        user_id: this.user.user_id,
      })
    }

    // Add an event to indicate that the user read the comments.
    const transaction = await sequelizeConn.transaction()
    await models.AnnotationEvent.bulkCreate(annotationEvents, {
      user: this.user,
      transaction: transaction,
      updateOnDuplicate: ['date_time'],
    })
    await transaction.commit()

    return {
      comments: comments,
    }
  }

  async addCellMedia(taxonId, characterIds, mediaIds, batchMode) {
    await this.checkCanDo(
      'editCellData',
      'You are not allowed to add media to cells'
    )
    await this.checkCanEditTaxa([taxonId])
    await this.checkCanEditCharacters(characterIds)

    const mediaList = await this.getMediaByIds(mediaIds)
    if (mediaList.size != mediaIds.length) {
      throw new UserError(
        'One or more of the media do not belong to the project'
      )
    }

    let cellBatch
    if (batchMode) {
      cellBatch = models.CellBatchLog.build({
        user_id: this.user.user_id,
        matrix_id: this.matrix.matrix_id,
        batch_type: CELL_BATCH_TYPES.MEDIA_BATCH_ADD,
        started_on: time(),
      })
    }

    const transaction = await sequelizeConn.transaction()

    const insertedCellMedia = []
    const mediaMap = new Map()
    for (const [mediaId, media] of mediaList) {
      mediaMap.set(mediaId, {
        icon: getMedia(media, 'icon'),
        tiny: getMedia(media, 'tiny'),
      })
      for (const characterId of characterIds) {
        const [cellMedia, created] = await models.CellsXMedium.findOrCreate({
          where: {
            matrix_id: this.matrix.matrix_id,
            taxon_id: taxonId,
            character_id: characterId,
            media_id: mediaId,
          },
          defaults: {
            matrix_id: this.matrix.matrix_id,
            taxon_id: taxonId,
            character_id: characterId,
            media_id: mediaId,
            user_id: this.user.user_id,
            created_on: time(),
            source: 'HTML5',
          },
          user: this.user,
          transaction: transaction,
        })
        if (created) {
          insertedCellMedia.push(cellMedia)
        }
      }
    }

    if (this.matrix.getOption('APPLY_CHARACTERS_WHILE_SCORING') == 1) {
      const media = await this.applyMediaRules(insertedCellMedia, transaction)
      insertedCellMedia.push(...media)
    }

    if (insertedCellMedia.length == 0) {
      await transaction.rollback()
      return {}
    }

    if (batchMode) {
      const taxon = await models.Taxon.findByPk(taxonId)
      cellBatch.finished_on = time()
      cellBatch.description = `${mediaIds.length} media added to ${
        characterIds.length
      } characters (s) in ${getTaxonName(taxon)} row`
      await cellBatch.save({ user: this.user, transaction: transaction })
    }

    const mediaResults = []
    for (const cellMedium of insertedCellMedia) {
      const mediaId = parseInt(cellMedium.media_id)
      mediaResults.push({
        link_id: parseInt(cellMedium.link_id),
        character_id: parseInt(cellMedium.character_id),
        taxon_id: parseInt(cellMedium.taxon_id),
        media_id: mediaId,
        ...mediaMap.get(mediaId),
      })
    }

    await transaction.commit()
    return {
      media: mediaResults,
    }
  }

  async removeCellMedia(taxonId, characterId, linkId, shouldTransferCitations) {
    await this.checkCanDo(
      'editCellData',
      'You are not allowed to remove media from cells'
    )
    await this.checkCanEditTaxa([taxonId])
    await this.checkCanEditCharacters([characterId])

    const transaction = await sequelizeConn.transaction()

    const cellMedia = await models.CellsXMedium.findByPk(linkId)
    if (cellMedia) {
      if (shouldTransferCitations) {
        await this.copyMediaCitationsToCell(cellMedia, transaction)
      }

      await cellMedia.destroy({ user: this.user, transaction: transaction })
    }

    await transaction.commit()
    return {
      character_id: characterId,
      taxon_id: taxonId,
      link_id: linkId,
      should_transfer_citations: shouldTransferCitations,
    }
  }

  async removeCellsMedia(taxonId, characterIds) {
    if (characterIds.length == 0) {
      throw new UserError('Please specify at least one character')
    }

    await this.checkCanDo(
      'editCellData',
      'You are not allowed to remove media in this matrix'
    )
    await this.checkCanEditTaxa([taxonId])
    await this.checkCanEditCharacters(characterIds)

    const startedTime = time()
    const transaction = await sequelizeConn.transaction()
    await models.CellsXMedium.destroy({
      where: {
        taxon_id: taxonId,
        character_id: characterIds,
      },
      individualHooks: true,
      user: this.user,
      transaction: transaction,
    })

    const taxon = await models.Taxon.findByPk(taxonId)
    const description = `All media deleted from ${
      characterIds.length
    } character(s) in ${getTaxonName(taxon)} row`
    await models.CellBatchLog.create(
      {
        user_id: this.user.user_id,
        matrix_id: this.matrix.matrix_id,
        batch_type: CELL_BATCH_TYPES.MEDIA_BATCH_DELETE,
        started_on: startedTime,
        description: description,
        finished_on: time(),
      },
      {
        user: this.user,
        transaction: transaction,
      }
    )

    await transaction.commit()
    return {
      taxon_id: taxonId,
      character_ids: characterIds,
    }
  }

  async getCellChanges(taxonId, characterId) {
    const [rows] = await sequelizeConn.query(
      `
      SELECT cgl.*, wu.fname, wu.lname, wu.email
      FROM cell_change_log cgl
      LEFT JOIN ca_users AS wu ON cgl.user_id = wu.user_id
      WHERE
        cgl.matrix_id = ? AND cgl.taxon_id = ? AND cgl.character_id = ?
      ORDER BY
        cgl.changed_on DESC`,
      { replacements: [this.matrix.matrix_id, taxonId, characterId] }
    )

    const logs = []
    for (const row of rows) {
      const changeType = row.change_type
      const tableNumber = parseInt(row.table_num)
      const snapshot = row.snapshot ? row.snapshot : {}

      let change = 'Unknown Change'
      switch (tableNumber) {
        case TABLE_NUMBERS.cells: {
          const stateId = row.state_id
          let scoreName = ''
          if (stateId) {
            const state = await models.CharacterState.findByPk(stateId)
            scoreName = `[${state.num}] ${state.name}`
          } else if (snapshot.is_npa) {
            scoreName = 'NPA'
          } else if (snapshot.start_value || snapshot.end_value) {
            if (snapshot.start_value) {
              scoreName = `Start: ${snapshot.start_value}`
            }
            if (snapshot.end_value) {
              scoreName += ` End: ${snapshot.end_value}`
            }
          }

          switch (changeType) {
            case 'I':
              change = `Set score to ${scoreName}`
              break
            case 'C':
            case 'U':
              change = `Set score to ${scoreName}`
              break
            case 'D':
              change = `Removed score ${scoreName}`
              break
          }
          break
        }
        case TABLE_NUMBERS.cells_x_media: {
          const mediaId = snapshot.media_id
          switch (changeType) {
            case 'I':
              change = `Added media M${mediaId}`
              break
            case 'C':
            case 'U':
              change = `Changed media to M${mediaId}`
              break
            case 'D':
              change = `Remove media M${mediaId}`
              break
          }
          break
        }
        case TABLE_NUMBERS.cell_notes: {
          let status
          switch (snapshot.status) {
            case 0:
              status = 'New'
              break
            case 50:
              status = 'In progress'
              break
            case 100:
              status = 'Complete'
              break
            default:
              status = '?'
              break
          }

          const notes = snapshot.notes
          switch (changeType) {
            case 'I':
              change = `Set cell notes to: '${notes}'<br/>Set status to: ${status}`
              break
            case 'C':
            case 'U':
              change = `Set cell notes to: '${notes}'<br/>Set status to: ${status}`
              break
            case 'D':
              change = `Removed cell notes and status; final notes were: '${notes}'<br/>Final status was: ${status}`
              break
          }
          break
        }
        case TABLE_NUMBERS.cells_x_bibliographic_references: {
          switch (changeType) {
            case 'I':
              change = 'Insert cell citation'
              break
            case 'C':
            case 'U':
              change = 'Update cell citation'
              break
            case 'D':
              change = 'Removed cell citation'
              break
          }
        }
      }
      logs.push({
        date: row.changed_on,
        user: `${row.fname} ${row.lname} (${row.email})`,
        log: change,
      })
    }
    logs.sort((a, b) => b.date - a.date)
    return { logs }
  }

  async getCellBatchLogs() {
    const [rows] = await sequelizeConn.query(
      `
      SELECT
        cl.*,
        CONCAT(cu.fname, ' ', cu.lname) as user,
        CONCAT(cu2.fname, ' ', cu2.lname) as reverted_user
      FROM cell_batch_log cl
      INNER JOIN ca_users AS cu ON cu.user_id = cl.user_id
      LEFT JOIN ca_users AS cu2 ON cu2.user_id = cl.reverted_user_id
      WHERE cl.matrix_id = ?`,
      { replacements: [this.matrix.matrix_id] }
    )

    const logs = []
    for (const row of rows) {
      let description = `${row.description} by ${row.user}`
      if (row.batch_type == 1) {
        description += ' using the cell media automation feature'
      }
      description += '.'
      if (row.reverted) {
        description += ` This was action was reverted by ${row.reverted_user}.`
      }

      logs.push({
        id: parseInt(row.log_id),
        r: row.reverted,
        t: parseInt(row.started_on),
        d: description,
      })
    }
    logs.sort((a, b) => b.t - a.t)
    return { batch_log: logs }
  }

  async copyCellScores(sourceTaxonId, destTaxonId, characterIds, options) {
    if (this.matrix.getOption('DISABLE_SCORING')) {
      throw new UserError(
        'Scoring has been disabled by the project administrator'
      )
    }

    if (characterIds.length == 0) {
      throw new UserError('Please specify at least one character')
    }

    await this.checkCanDo(
      'editCellData',
      'You are not allowed to modify cells in this matrix'
    )
    await this.checkCanEditTaxa([destTaxonId])
    await this.checkCanEditCharacters(characterIds)

    const transaction = await sequelizeConn.transaction()

    const batchMode = options != null && parseInt(options['batchmode'])
    let cellBatch
    if (batchMode) {
      cellBatch = models.CellBatchLog.build({
        user_id: this.user.user_id,
        matrix_id: this.matrix.matrix_id,
        batch_type: CELL_BATCH_TYPES.COPY_SCORES,
        started_on: time(),
      })
    }

    const notesChangesResults = []
    const copyNotes = options != null && parseInt(options['copyNotes'])
    if (copyNotes) {
      const notes = await models.CellNote.findAll({
        where: {
          matrix_id: this.matrix.matrix_id,
          taxon_id: [sourceTaxonId, destTaxonId],
          character_id: characterIds,
        },
      })
      const notesMap = new Table()
      for (const note of notes) {
        notesMap.set(note.character_id, note.taxon_id, note)
      }

      for (const characterId of characterIds) {
        const sourceNotes = notesMap.get(characterId, sourceTaxonId)
        const destNotes = notesMap.get(characterId, destTaxonId)
        if (sourceNotes) {
          if (destNotes) {
            destNotes.notes = sourceNotes.notes
            destNotes.status = sourceNotes.status
            destNotes.source = 'HTML5'
            await destNotes.save({ user: this.user, transaction: transaction })
          } else {
            await models.CellNote.create(
              {
                matrix_id: this.matrix.matrix_id,
                taxon_id: destTaxonId,
                character_id: characterId,
                user_id: this.user.user_id,
                notes: sourceNotes.notes,
                status: sourceNotes.status,
                source: 'HTML5',
              },
              {
                user: this.user,
                transaction: transaction,
              }
            )
          }
          notesChangesResults.push({
            taxon_id: destTaxonId,
            character_id: characterId,
            notes: sourceNotes.notes,
            status: sourceNotes.status,
          })
        } else {
          if (destNotes) {
            await destNotes.destroy({
              user: this.user,
              transaction: transaction,
            })
          }
          notesChangesResults.push({
            taxon_id: destTaxonId,
            character_id: characterId,
            notes: '',
            status: 0,
          })
        }
      }
    }

    const insertedScores = []
    const cellChangesResults = []
    const allCellScores = await this.getCellsStates(
      [sourceTaxonId, destTaxonId],
      characterIds
    )
    for (const characterId of characterIds) {
      let sourceScores = allCellScores.get(sourceTaxonId, characterId)
      if (sourceScores == null) {
        sourceScores = new Map()
      }

      let destScores = allCellScores.get(destTaxonId, characterId)
      if (destScores == null) {
        destScores = new Map()
      }

      const sourceScoresIds = Array.from(sourceScores.keys())
      const destScoresIds = Array.from(destScores.keys())

      const scoresIdsToDelete = array_difference(destScoresIds, sourceScoresIds)
      const scoresIdsToInsert = array_difference(sourceScoresIds, destScoresIds)
      const unchangedScoreIds = array_intersect(destScoresIds, sourceScoresIds)

      for (const unchangedScoreId of unchangedScoreIds) {
        const sourceSource = sourceScores.get(unchangedScoreId)
        const destSource = destScores.get(unchangedScoreId)

        // Ensure that uncertain scores and continuous values are updated
        // properly.
        const isUncertainChanged =
          destSource.is_uncertain != sourceSource.is_uncertain
        const continuousChanged =
          destSource.start_value != sourceSource.start_value ||
          destSource.end_value != sourceSource.end_value
        if (isUncertainChanged || continuousChanged) {
          const cell = await models.Cell.findByPk(destScores.cell_id)

          if (isUncertainChanged) {
            cell.is_uncertain = sourceSource.is_uncertain
            destSource.is_uncertain = sourceSource.is_uncertain
          }

          if (continuousChanged) {
            cell.start_value = sourceSource.start_value
            cell.end_value = sourceSource.end_value
            destSource.start_value = sourceSource.start_value
            destSource.end_value = sourceSource.end_value
          }

          await cell.save({
            user: this.user,
            transaction: transaction,
          })
        }
        cellChangesResults.push(destSource)
      }

      for (const scoreId of scoresIdsToDelete) {
        const cellScore = destScores.get(scoreId)
        await models.Cell.destroy({
          where: { cell_id: cellScore.cell_id },
          transaction: transaction,
          user: this.user,
        })
        cellScore.cell_id = 0 // Signal that the cell should be deleted.
        cellChangesResults.push(cellScore)
      }

      for (const scoreId of scoresIdsToInsert) {
        const cellScore = sourceScores.get(scoreId)
        const cell = await models.Cell.create(
          {
            matrix_id: this.matrix.matrix_id,
            taxon_id: destTaxonId,
            character_id: characterId,
            user_id: this.user.user_id,
            state_id: scoreId > 0 ? scoreId : null,
            is_npa: scoreId == -1 ? 1 : 0,
            is_uncertain: cellScore.is_uncertain,
            start_value: cellScore.start_value,
            end_value: cellScore.end_value,
          },
          { user: this.user, transaction: transaction }
        )
        cellChangesResults.push(cell)
        insertedScores.push(cell)
      }
    }

    if (this.matrix.getOption('APPLY_CHARACTERS_WHILE_SCORING') == 1) {
      const scores = await this.applyStateRules(insertedScores)
      cellChangesResults.push(...scores)
    }

    const deletedCellMedia =
      this.matrix.getOption('ENABLE_CELL_MEDIA_AUTOMATION') == 1
        ? await this.cellMediaToDeleteFromCharacterView(
            [destTaxonId],
            characterIds
          )
        : []
    if (deletedCellMedia.length > 0) {
      const linkIds = deletedCellMedia.map((media) => parseInt(media.link_id))
      await models.CellsXMedium.destroy({
        where: {
          where: { link_id: linkIds },
          transaction: transaction,
          individualHooks: true,
          user: this.user,
        },
      })
    }

    if (
      batchMode &&
      (cellChangesResults.length ||
        notesChangesResults.length ||
        deletedCellMedia.length)
    ) {
      const sourceTaxon = await models.Taxon.findByPk(sourceTaxonId)
      const destTaxon = await models.Taxon.findByPk(destTaxonId)
      const sourceTaxonName = getTaxonName(sourceTaxon)
      const destTaxonName = getTaxonName(destTaxon)
      cellBatch.finished_on = time()
      cellBatch.description = `Copy from ${sourceTaxonName} taxon row to ${destTaxonName} taxon row`
      await cellBatch.save({ user: this.user, transaction: transaction })
    }

    await transaction.commit()
    return {
      src_taxon_id: sourceTaxonId,
      dst_taxon_id: destTaxonId,
      character_ids: characterIds,
      cells: await this.convertCellQueryToResults(cellChangesResults),
      cell_notes: notesChangesResults,
      deleted_cell_media: deletedCellMedia,
    }
  }

  async undoCellBatch(logId) {
    const cellBatch = await models.CellBatchLog.findByPk(logId)
    if (!cellBatch) {
      throw new UserError('Batch does not exist')
    }

    if (cellBatch.matrix_id != this.matrix.matrix_id) {
      throw new UserError('Matrix id is not related to Batch')
    }

    const transaction = await sequelizeConn.transaction()

    const [rows] = await sequelizeConn.query(
      `
      SELECT *
      FROM cell_change_log
      WHERE
        matrix_id = ? AND
        user_id = ? AND
        changed_on >= ? AND
        changed_on <= ?
      ORDER BY change_id DESC`,
      {
        replacements: [
          cellBatch.matrix_id,
          cellBatch.user_id,
          cellBatch.started_on,
          cellBatch.finished_on,
        ],
      }
    )

    const updates = {
      updated_cell_notes: [],
      deleted_citations: [],
      added_citations: [],
      updated_citations: [],
      deleted_media: [],
      added_media: [],
      deleted_scores: [],
      added_scores: [],
    }
    for (const row of rows) {
      const snapshot = row.snapshot || {}
      const cell = {
        matrix_id: row.matrix_id,
        taxon_id: row.taxon_id,
        character_id: row.character_id,
      }

      switch (row.table_num) {
        case TABLE_NUMBERS.cell_notes: {
          const cellNotes = await models.CellNote.findAll({
            where: { ...cell },
          })
          switch (row.change_type) {
            case 'I': {
              for (const cellNote of cellNotes) {
                cellNote.note = ''
                cellNote.status = 0
                await cellNote.save({
                  user: this.user,
                  transaction: transaction,
                })
                updates.updated_cell_notes.push({
                  ...cell,
                  notes: '',
                  status: 0,
                })
              }
              break
            }
            case 'U': {
              for (const cellNote of cellNotes) {
                if (snapshot.notes) {
                  cellNote.notes = snapshot.notes
                }
                if (snapshot.status) {
                  cellNote.status = snapshot.status
                }
                await cellNote.save({
                  user: this.user,
                  transaction: transaction,
                })
                updates.updated_cell_notes.push({
                  ...cell,
                  notes: cellNote.notes,
                  status: cellNote.status,
                })
              }
              break
            }
          }
          break
        }
        case TABLE_NUMBERS.cells_x_bibliographic_references: {
          const linkId = snapshot.link_id
          const citationSnapshot = {
            ...cell,
            reference_id: snapshot.reference_id,
            notes: snapshot.notes,
            pp: snapshot.pp,
          }
          switch (row.change_type) {
            case 'I': {
              const citation =
                await models.CellsXBibliographicReference.findByPk(linkId)
              if (
                citation &&
                citation.reference_id == citationSnapshot.reference_id &&
                citation.character_id == citationSnapshot.character_id &&
                citation.taxon_id == citationSnapshot.taxon_id
              ) {
                citation.destroy({
                  user: this.user,
                  transaction: transaction,
                })
                updates.deleted_citations.push(citationSnapshot)
              }
              break
            }
            case 'D': {
              await models.CellsXBibliographicReference.create(
                {
                  ...citationSnapshot,
                  user_id: this.user.user_id,
                },
                {
                  user: this.user,
                  transaction: transaction,
                }
              )
              updates.added_citations.push(citationSnapshot)
              break
            }
            case 'U': {
              const citation =
                await models.CellsXBibliographicReference.findByPk(linkId)
              if (citation) {
                citation.set(citationSnapshot)
                await citation.save({
                  user: this.user,
                  transaction: transaction,
                })
              }
              break
            }
          }
          break
        }
        case TABLE_NUMBERS.cells_x_media: {
          const mediaId = parseInt(snapshot.media_id)
          const mediaSnapshot = {
            ...cell,
            media_id: mediaId,
          }
          switch (row.change_type) {
            case 'I': {
              const cellMedia = await models.CellsXMedium.findAll({
                where: { ...mediaSnapshot },
              })
              for (const cellMedium of cellMedia) {
                mediaSnapshot.link_id = cellMedium.link_id
                await cellMedium.destroy({
                  user: this.user,
                  transaction: transaction,
                })
                updates.deleted_media.push(mediaSnapshot)
              }
              break
            }
            case 'D': {
              const mediaFile = await models.MediaFile.findByPk(mediaId)
              await models.CellsXMedium.create(
                {
                  ...mediaSnapshot,
                  user_id: this.user.user_id,
                },
                {
                  user: this.user,
                  transaction: transaction,
                }
              )

              updates.added_media.push({
                ...mediaSnapshot,
                icon: getMedia(mediaFile.media, 'icon'),
                tiny: getMedia(mediaFile.media, 'tiny'),
              })
              break
            }
            default:
            case 'U':
              throw 'We should never get an update for a cell media'
          }
          break
        }
        case TABLE_NUMBERS.cells: {
          const cellSnapshot = {
            ...cell,
            state_id: row.state_id,
          }
          switch (row.change_type) {
            case 'I':
              await models.Cell.destroy({
                where: {
                  ...cellSnapshot,
                  user_id: row.user_id,
                },
                individualHooks: true,
                user: this.user,
                transaction: transaction,
              })
              updates.deleted_scores.push(cellSnapshot)
              break
            case 'D': {
              const cell = await models.Cell.create(
                {
                  ...cellSnapshot,
                  user_id: this.user.user_id,
                  is_npa: snapshot.is_npa,
                  is_uncertain: snapshot.is_uncertain,
                  start_value: snapshot.start_value ?? null,
                  end_value: snapshot.end_value ?? null,
                },
                {
                  user: this.user,
                  transaction: transaction,
                }
              )
              updates.added_scores.push(cell)
              break
            }
            default:
            case 'U': {
              const cells = await models.Cell.findAll({
                where: { ...cellSnapshot },
              })
              for (const cell of cells) {
                cell.set(snapshot)
                await cell.save({
                  user: this.user,
                  transaction: transaction,
                })
                updates.deleted_scores.push(cellSnapshot)
                updates.added_scores.push(cell)
              }
              break
            }
          }
          break
        }
      }
    }

    cellBatch.reverted = 1
    cellBatch.reverted_user_id = this.user.user_id
    await cellBatch.save({
      user: this.user,
      transaction: transaction,
    })
    await transaction.commit()
    return updates
  }

  async logCellCheck(taxaIds, characterIds) {
    if (taxaIds.length == 0) {
      throw new UserError('Please specify at least one taxon')
    }
    if (characterIds.length == 0) {
      throw new UserError('Please specify at least one character')
    }
    if (this.matrix.getOption('DISABLE_SCORING')) {
      throw new UserError(
        'Scoring has been disabled by the project administrator'
      )
    }
    await this.checkCanDo(
      'editCellData',
      'You are not allowed to modify cells in this matrix'
    )
    await this.checkCanEditTaxa(taxaIds)
    await this.checkCanEditCharacters(characterIds)

    const startedTime = time()
    const replacements = []
    for (const taxonId of taxaIds) {
      for (const characterId of characterIds) {
        replacements.push([
          'C',
          TABLE_NUMBERS.cell,
          this.user.user_id,
          startedTime,
          this.matrix.matrix_id,
          characterId,
          taxonId,
        ])
      }
    }

    const transaction = await sequelizeConn.transaction()
    await sequelizeConn.query(
      `
      INSERT INTO cell_change_log(
        change_type, table_num, user_id, changed_on, matrix_id, character_id,
        taxon_id)
      VALUES ?`,
      {
        replacements: [replacements],
        transaction: transaction,
      }
    )
    transaction.commit()
    return {
      ts: startedTime,
    }
  }

  async addPartition(name, description) {
    await this.checkCanDo(
      'editPartition',
      'You are not allowed to add partitions'
    )

    await this.checkPartitionNameExists(name)

    const transaction = await sequelizeConn.transaction()
    const partition = await models.Partition.create(
      {
        project_id: this.project.project_id,
        user_id: this.user.user_id,
        name: name,
        description: description,
        source: 'HTML5',
      },
      { user: this.user, transaction: transaction }
    )

    return {
      id: partition.partition_id,
      name: name,
      description: description,
      user_id: this.user.user_id,
      project_id: this.project.project_id,
    }
  }

  async editPartition(partitionId, name, description) {
    await this.checkCanDo(
      'editPartition',
      'You are not allowed to modify partitions'
    )

    const transaction = await sequelizeConn.transaction()
    const partition = await models.Partition.findByPk(partitionId)
    if (!partition || partition.project_id != this.project.project_id) {
      throw new UserError('Invalid Partition id')
    }

    if (partition.name != name) {
      const [[{ count }]] = await sequelizeConn.query(
        'SELECT COUNT(*) AS count FROM partitions WHERE partition_id != ? AND name = ?',
        { replacements: [partitionId, name] }
      )
      if (count) {
        throw new UserError('Partition by the given name already exists')
      }

      partition.name = name
    }

    partition.description = description
    partition.source = 'HTML5'

    await partition.save({ user: this.user, transaction: transaction })
    await transaction.commit()
    return {
      id: partition.partition_id,
      name: name,
      description: description,
      user_id: this.user.user_id,
      project_id: this.project.project_id,
    }
  }

  async copyPartition(partitionId, name, description) {
    await this.checkCanDo(
      'editPartition',
      'You are not allowed to copy partitions'
    )

    await this.checkPartitionNameExists(name)

    const partition = await models.Partition.findByPk(partitionId)
    if (!partition) {
      throw new UserError('Partition does not exist')
    }
    if (partition.project_id != this.project.project_id) {
      throw new UserError('The given partition does not belong to this project')
    }

    const [characterRows] = await sequelizeConn.query(
      'SELECT character_id FROM characters_x_partitions WHERE partition_id = ?',
      { replacements: [partitionId] }
    )
    const characterIds = characterRows.map((row) => parseInt(row.character_id))

    const [taxaRows] = await sequelizeConn.query(
      'SELECT taxon_id FROM taxa_x_partitions WHERE partition_id = ? ',
      { replacements: [partitionId] }
    )
    const taxaIds = taxaRows.map((row) => parseInt(row.taxon_id))

    const transaction = await sequelizeConn.transaction()
    const newPartition = await models.Partition.create(
      {
        project_id: this.project.project_id,
        user_id: this.user.user_id,
        name: name,
        description: description,
        source: 'HTML5',
      },
      { user: this.user, transaction: transaction }
    )

    for (const taxonId of taxaIds) {
      await models.TaxaXPartition.create(
        {
          taxon_id: taxonId,
          partition_id: newPartition.partition_id,
          user_id: this.user.user_id,
        },
        {
          user: this.user,
          transaction: transaction,
        }
      )
    }

    for (const characterId of characterIds) {
      await models.CharactersXPartition.create(
        {
          character_id: characterId,
          partition_id: newPartition.partition_id,
          user_id: this.user.user_id,
        },
        {
          user: this.user,
          transaction: transaction,
        }
      )
    }
    await transaction.commit()
    return {
      id: newPartition.partition_id,
      name: name,
      description: description,
      user_id: this.user.user_id,
      project_id: this.project.project_id,
      taxa_ids: taxaIds,
      character_ids: characterIds,
    }
  }

  async checkPartitionNameExists(name) {
    const [[{ count }]] = await sequelizeConn.query(
      'SELECT COUNT(*) AS count FROM partitions WHERE project_id = ? AND name = ?',
      { replacements: [this.project.project_id, name] }
    )
    if (count) {
      throw new UserError('Partition by the given name already exists')
    }
  }

  async removePartition(partitionId) {
    await this.checkCanDo(
      'editPartition',
      'You are not allowed to remove partitions'
    )
    const transaction = await sequelizeConn.transaction()
    await models.Partition.destroy({
      where: {
        partition_id: partitionId,
        project_id: this.project.project_id,
      },
      individualHooks: true,
      user: this.user,
      transaction: transaction,
    })
    await transaction.commit()
    return {
      id: partitionId,
    }
  }

  async addCharactersToPartition(partitionId, characterIds) {
    await this.checkCanDo(
      'editPartition',
      'You are not allowed to add characters to partitions'
    )

    if (characterIds.length == 0) {
      throw new UserError('Please specify characters')
    }

    const partition = await models.Partition.findByPk(partitionId)
    if (!partition) {
      throw new UserError('Partition does not exist')
    }
    if (partition.project_id != this.project.project_id) {
      throw new UserError('The given partition does not belong to this project')
    }

    await this.checkCharactersInProject(characterIds)
    const transaction = await sequelizeConn.transaction()
    for (const characterId of characterIds) {
      await models.CharactersXPartition.findOrCreate({
        where: {
          character_id: characterId,
          partition_id: partitionId,
        },
        defaults: {
          character_id: characterId,
          partition_id: partitionId,
          user_id: this.user.user_id,
        },
        user: this.user,
        transaction: transaction,
      })
    }
    await transaction.commit()
    return {
      id: partitionId,
      character_ids: characterIds,
    }
  }

  async removeCharactersFromPartition(partitionId, characterIds) {
    await this.checkCanDo(
      'editPartition',
      'You are not allowed to remove characters from partitions'
    )

    if (characterIds.length == 0) {
      throw new UserError('Please specify characters')
    }

    const partition = await models.Partition.findByPk(partitionId)
    if (!partition) {
      throw new UserError('Partition does not exist')
    }
    if (partition.project_id != this.project.project_id) {
      throw new UserError('The given partition does not belong to this project')
    }

    await this.checkCharactersInProject(characterIds)
    const transaction = await sequelizeConn.transaction()
    await models.CharactersXPartition.destroy({
      where: {
        partition_id: partitionId,
        character_id: characterIds,
      },
      individualHooks: true,
      user: this.user,
      transaction: transaction,
    })
    await transaction.commit()
    return {
      id: partitionId,
      character_ids: characterIds,
    }
  }

  async addTaxaToPartition(partitionId, taxaIds) {
    await this.checkCanDo(
      'editPartition',
      'You are not allowed to add taxa to partitions'
    )

    if (taxaIds.length == 0) {
      throw new UserError('Please specify taxa')
    }

    const partition = await models.Partition.findByPk(partitionId)
    if (!partition) {
      throw new UserError('Partition does not exist')
    }
    if (partition.project_id != this.project.project_id) {
      throw new UserError('The given partition does not belong to this project')
    }

    await this.checkTaxaInProject(taxaIds)
    const transaction = await sequelizeConn.transaction()
    for (const taxonId of taxaIds) {
      await models.TaxaXPartition.findOrCreate({
        where: {
          taxon_id: taxonId,
          partition_id: partitionId,
        },
        defaults: {
          taxon_id: taxonId,
          partition_id: partitionId,
          user_id: this.user.user_id,
        },
        user: this.user,
        transaction: transaction,
      })
    }
    await transaction.commit()
    return {
      id: partitionId,
      taxon_ids: taxaIds,
    }
  }

  async removeTaxaFromPartition(partitionId, taxaIds) {
    await this.checkCanDo(
      'editPartition',
      'You are not allowed to remove taxa from partitions'
    )

    if (taxaIds.length == 0) {
      throw new UserError('Please specify taxa')
    }

    const partition = await models.Partition.findByPk(partitionId)
    if (!partition) {
      throw new UserError('Partition does not exist')
    }
    if (partition.project_id != this.project.project_id) {
      throw new UserError('The given partition does not belong to this project')
    }

    await this.checkTaxaInProject(taxaIds)
    const transaction = await sequelizeConn.transaction()
    await models.TaxaXPartition.destroy({
      where: {
        partition_id: partitionId,
        taxon_id: taxaIds,
      },
      individualHooks: true,
      user: this.user,
      transaction: transaction,
    })
    await transaction.commit()
    return {
      id: partitionId,
      taxon_ids: taxaIds,
    }
  }

  getMatrixInfo() {
    return {
      id: this.matrix.matrix_id,
      t: this.matrix.title,
      ty: parseInt(this.matrix.type),
    }
  }

  getOptions() {
    const options = {}
    for (const key of MATRIX_OPTIONS) {
      options[key] = parseInt(this.matrix.other_options[key])
    }
    return options
  }

  /**
   * Return access information/preferences/permissions for current user
   */
  async getUserAccessInfo() {
    return {
      available_groups: await this.getMemberGroups(),
      user_groups: await this.getUserMemberGroups(),
      is_admin: await this.isAdminLike(),
      user_id: parseInt(this.user.user_id),
      last_login: this.user.getLastLogout(),
      allowable_actions: await this.getUserAllowableActions(),
      allowable_publish: this.getPublishAllowableActions(),
      preferences: await this.getPreferences(),
      ...(await this.getPublicAccessInfo()),
    }
  }

  async getPublicAccessInfo() {
    return {
      created_on: parseInt(this.matrix.created_on),
      upload_times: await this.getUploadedTimes(),
      status: parseInt(this.project.published),
      members: await this.getMembers(),
    }
  }

  getPublishAllowableActions() {
    return {
      publish_character_comments: this.project.publish_character_comments,
      publish_cell_comments: this.project.publish_cell_comments,
      publish_copyrighted_media: this.project.publish_copyrighted_media,
      publish_change_logs: this.project.publish_change_logs,
      publish_bibliography: this.project.publish_bibliography,
      publish_cell_notes: this.project.publish_cell_notes,
    }
  }

  async fetchChanges(changedTime) {
    const modifiedCharacterIds = new Set()
    const modifiedTaxaIds = new Set()
    const cells = []
    const notes = []
    const citations = []
    const media = []

    // Query for deleted states, notes, and citations
    const [deletedRows] = await sequelizeConn.query(
      `
      SELECT character_id, taxon_id, table_num, change_type
      FROM cell_change_log
      WHERE
        matrix_id = ? AND
        user_id != ? AND
        changed_on > ? AND
        table_num IN (6, 7, 29, 41)`,
      { replacements: [this.matrix.matrix_id, this.user.user_id, changedTime] }
    )
    for (const row of deletedRows) {
      const taxonId = parseInt(row.taxon_id)
      const characterId = parseInt(row.character_id)
      const tableNum = parseInt(row.table_num)

      modifiedTaxaIds.add(taxonId)
      modifiedCharacterIds.add(characterId)

      switch (tableNum) {
        case TABLE_NUMBERS.cells:
          if (row.change_type == 'D') {
            cells.push({
              cell_id: 0,
              taxon_id: taxonId,
              character_id: characterId,
            })
          }
          break
        case TABLE_NUMBERS.cells_x_media:
          if (row.change_type == 'D') {
            media.push({
              taxon_id: taxonId,
              character_id: characterId,
            })
          }
          break
        case TABLE_NUMBERS.cell_notes:
          if (row.change_type == 'D') {
            notes.push({
              notes: '',
              status: 0,
              taxon_id: taxonId,
              character_id: characterId,
            })
          }
          break
        case TABLE_NUMBERS.cells_x_bibliographic_references:
          citations.push({
            taxon_id: taxonId,
            character_id: characterId,
          })
          break
      }
    }

    const [updatedScoresRows] = await sequelizeConn.query(
      `
      SELECT
        DISTINCT c.cell_id, c.user_id, c.taxon_id, c.character_id, c.created_on,
        c.state_id, c.is_npa, c.is_uncertain, c.start_value, c.end_value,
        ch.type
      FROM cells c
      INNER JOIN cell_change_log AS ccl ON
        ccl.matrix_id = c.matrix_id AND
        ccl.character_id = c.character_id AND
        ccl.taxon_id = c.taxon_id
      INNER JOIN characters AS ch ON ch.character_id = c.character_id
      WHERE
        ccl.table_num = 6 AND
        c.matrix_id = ? AND
        ccl.user_id != ? AND
        ccl.changed_on > ?`,
      { replacements: [this.matrix.matrix_id, this.user.user_id, changedTime] }
    )
    for (const row of updatedScoresRows) {
      const taxonId = parseInt(row.taxon_id)
      const characterId = parseInt(row.character_id)
      modifiedTaxaIds.add(taxonId)
      modifiedCharacterIds.add(characterId)
      cells.push(row)
    }

    const [updatedNotesRows] = await sequelizeConn.query(
      `
      SELECT DISTINCT note_id, n.notes, n.status, n.taxon_id, n.character_id
      FROM cell_notes n
      INNER JOIN cell_change_log AS ccl ON
        ccl.matrix_id = n.matrix_id AND
        ccl.character_id = n.character_id AND
        ccl.taxon_id = n.taxon_id
      WHERE
        ccl.table_num = 29 AND
        ccl.matrix_id = ? AND
        ccl.user_id != ? AND
        changed_on >= ?`,
      { replacements: [this.matrix.matrix_id, this.user.user_id, changedTime] }
    )
    for (const row of updatedNotesRows) {
      const taxonId = parseInt(row.taxon_id)
      const characterId = parseInt(row.character_id)

      modifiedTaxaIds.add(taxonId)
      modifiedCharacterIds.add(characterId)

      notes.push({
        taxon_id: taxonId,
        character_id: characterId,
        status: parseInt(row.status),
        notes: row.notes,
      })
    }

    // Label counting for updated media
    const [labelCountsRows] = await sequelizeConn.query(
      `
      SELECT cxm.character_id, cxm.taxon_id, cxm.media_id, count(*) label_count
      FROM media_labels ml
      INNER JOIN cells_x_media AS cxm ON
        cxm.link_id = ml.link_id AND
        cxm.media_id = ml.media_id
      INNER JOIN media_files AS mf ON
        mf.media_id = cxm.media_id
      INNER JOIN cell_change_log AS ccl ON
        ccl.matrix_id = cxm.matrix_id AND
        ccl.character_id = cxm.character_id AND
        ccl.taxon_id = cxm.taxon_id
      WHERE
        ml.table_num = 7 AND
        cxm.matrix_id = ? AND
        ccl.table_num = 7 AND
        ccl.user_id != ? AND
        ccl.changed_on >= ?
      GROUP BY cxm.character_id, cxm.taxon_id, cxm.media_id`,
      { replacements: [this.matrix.matrix_id, this.user.user_id, changedTime] }
    )
    const labelCounts = new HyperTable()
    for (const row of labelCountsRows) {
      const taxonId = parseInt(row.taxon_id)
      const characterId = parseInt(row.character_id)
      const mediaId = parseInt(row.media_id)
      const count = parseInt(row.label_count)
      labelCounts.set(taxonId, characterId, mediaId, count)
    }

    const [mediaRows] = await sequelizeConn.query(
      `
      SELECT
        cxm.media_id, cxm.taxon_id, cxm.character_id, mf.media, mf.notes,
        cxm.link_id
      FROM cells_x_media cxm
      INNER JOIN cell_change_log AS ccl ON
        ccl.matrix_id = cxm.matrix_id AND
        ccl.character_id = cxm.character_id AND
        ccl.taxon_id = cxm.taxon_id
      INNER JOIN media_files AS mf ON
        cxm.media_id = mf.media_id
      WHERE
        ccl.table_num = 7 AND
        cxm.matrix_id = ? AND
        ccl.user_id != ? AND
        ccl.changed_on >= ?`,
      { replacements: [this.matrix.matrix_id, this.user.user_id, changedTime] }
    )
    for (const row of mediaRows) {
      const linkId = parseInt(row.link_id)
      const taxonId = parseInt(row.taxon_id)
      const characterId = parseInt(row.character_id)
      const mediaId = parseInt(row.media_id)

      modifiedTaxaIds.add(taxonId)
      modifiedCharacterIds.add(characterId)

      media.push({
        link_id: linkId,
        taxon_id: taxonId,
        character_id: characterId,
        media_id: mediaId,
        icon: getMedia(row.media, 'icon'),
        tiny: getMedia(row.media, 'tiny'),
        label_count: labelCounts.get(taxonId, characterId, mediaId) ?? 0,
      })
    }

    // The first query returns characters who were changed, the second query
    // returns the character whose states were changed, the third query returns
    // all updates to the character.
    const [characterRows] = await sequelizeConn.query(
      `
      SELECT DISTINCT mco.character_id
      FROM matrix_character_order AS mco
      LEFT JOIN ca_change_log AS ccl ON
        ccl.logged_row_id = mco.character_id
      WHERE
        mco.matrix_id = ? AND
        ccl.user_id != ? AND
        ccl.log_datetime > ? AND
        ccl.logged_table_num = 3
      UNION
      SELECT DISTINCT mco.character_id
      FROM ca_change_log AS ccl
      LEFT JOIN character_states AS cs ON
        cs.state_id = ccl.logged_row_id
      LEFT JOIN matrix_character_order AS mco ON
        mco.character_id = cs.character_id
      WHERE
        mco.matrix_id = ? AND
        ccl.user_id != ? AND
        ccl.log_datetime > ? AND
        ccl.logged_table_num = 4
      UNION
      SELECT DISTINCT mco.character_id
      FROM character_change_log AS ccl
      LEFT JOIN matrix_character_order AS mco ON
        mco.character_id = ccl.character_id
      WHERE
        mco.matrix_id = ? AND
        ccl.user_id != ? AND
        ccl.changed_on > ?`,
      {
        replacements: [
          this.matrix.matrix_id,
          this.user.user_id,
          changedTime,
          this.matrix.matrix_id,
          this.user.user_id,
          changedTime,
          this.matrix.matrix_id,
          this.user.user_id,
          changedTime,
        ],
      }
    )
    const changedCharacterIds = new Set()
    for (const row of characterRows) {
      changedCharacterIds.add(parseInt(row.character_id))
    }

    const characters = changedCharacterIds.size
      ? this.getCharacters(Array.from(changedCharacterIds))
      : []

    // The first query gets the changed taxon, the second gets reodered taxa,
    // the third gets taxa whose media was updated.
    const [taxaRows] = await sequelizeConn.query(
      `
      SELECT DISTINCT mto.taxon_id
      FROM matrix_taxa_order AS mto
      LEFT JOIN ca_change_log AS ccl ON
        ccl.logged_row_id = mto.taxon_id
      WHERE
        mto.matrix_id = ? AND
        ccl.user_id != ? AND
        ccl.log_datetime > ? AND
        ccl.logged_table_num = 10
      UNION
      SELECT DISTINCT mto.taxon_id
      FROM matrix_taxa_order AS mto
      LEFT JOIN ca_change_log AS ccl ON
        ccl.logged_row_id = mto.order_id
      WHERE
        mto.matrix_id = ? AND
        ccl.user_id != ? AND
        ccl.log_datetime > ? AND
        ccl.logged_table_num = 24
      UNION
      SELECT DISTINCT mto.taxon_id
      FROM matrix_taxa_order AS mto
      LEFT JOIN ca_change_log AS ccl ON
        mto.matrix_id = ccl.logged_row_id
      WHERE
        mto.matrix_id = ? AND
        ccl.user_id != ? AND
        ccl.log_datetime > ? AND
        ccl.logged_table_num = 5
      UNION
      SELECT DISTINCT txm.taxon_id
      FROM taxa_x_media AS txm
      INNER JOIN matrix_taxa_order AS mto ON
        mto.taxon_id = txm.taxon_id
      LEFT JOIN ca_change_log AS ccl ON
        ccl.logged_row_id = txm.link_id
      WHERE
        mto.matrix_id = ? AND
        ccl.user_id != ? AND
        ccl.log_datetime > ? AND
        ccl.logged_table_num = 53`,
      {
        replacements: [
          this.matrix.matrix_id,
          this.user.user_id,
          changedTime,
          this.matrix.matrix_id,
          this.user.user_id,
          changedTime,
          this.matrix.matrix_id,
          this.user.user_id,
          changedTime,
          this.matrix.matrix_id,
          this.user.user_id,
          changedTime,
        ],
      }
    )
    const changedTaxaIds = new Set()
    for (const row of taxaRows) {
      changedTaxaIds.add(parseInt(row.taxon_id))
    }

    const taxa = changedTaxaIds.size
      ? this.getTaxa(Array.from(changedTaxaIds))
      : []

    const [changedRows] = await sequelizeConn.query(
      `
      SELECT 1 AS changed
      FROM ca_change_log
      WHERE
        logged_table_num = 5 AND
        logged_row_id = ? AND
        user_id != ? AND
        log_datetime > ?`,
      { replacements: [this.matrix.matrix_id, this.user.user_id, changedTime] }
    )
    let order = null
    if (changedRows.length) {
      const [characterRows] = await sequelizeConn.query(
        `
        SELECT character_id
        FROM matrix_character_order
        WHERE matrix_id = ?
        ORDER BY position`,
        { replacements: [this.matrix.matrix_id] }
      )

      const [taxaRows] = await sequelizeConn.query(
        `
        SELECT taxon_id
        FROM matrix_taxa_order
        WHERE matrix_id = ?
        ORDER BY position`,
        { replacements: [this.matrix.matrix_id] }
      )
      order = {
        taxa: taxaRows.map((row) => parseInt(row.taxon_id)),
        characters: characterRows.map((row) => parseInt(row.character_id)),
      }
    }

    // The first query is for partition IDs of new partitions, the second query
    // is for the partition IDs of partitions that have had characters added to
    // them, the third query is for the partition IDs of partitions that have
    // had taxa added to them.
    const [partitionRows] = await sequelizeConn.query(
      `
      SELECT DISTINCT p.partition_id
      FROM partitions p
      INNER JOIN ca_change_log AS ccl ON
        ccl.logged_row_id = p.partition_id
      INNER JOIN matrices AS m ON
        m.project_id = p.project_id
      WHERE
        m.matrix_id = ? AND
        ccl.log_datetime > ? AND
        ccl.user_id != ? AND
        ccl.logged_table_num = 59
      UNION
      SELECT DISTINCT cxp.partition_id
      FROM characters_x_partitions AS cxp
      INNER JOIN ca_change_log AS ccl ON
        ccl.logged_row_id = cxp.link_id
      INNER JOIN partitions AS p ON
        p.partition_id = cxp.partition_id
      INNER JOIN matrices AS m ON
        m.project_id = p.project_id
      WHERE
        m.matrix_id = ? AND
        ccl.log_datetime > ? AND
        ccl.user_id != ? AND
        ccl.logged_table_num = 60
      UNION
      SELECT DISTINCT txp.partition_id
      FROM taxa_x_partitions AS txp
      INNER JOIN ca_change_log AS ccl ON
        ccl.logged_row_id = txp.link_id
      INNER JOIN partitions AS p ON
        p.partition_id = txp.partition_id
      INNER JOIN matrices AS m ON
        m.project_id = p.project_id
      WHERE
        m.matrix_id = ? AND
        ccl.log_datetime > ? AND
        ccl.user_id != ? AND
        ccl.logged_table_num = 61`,
      {
        replacements: [
          this.matrix.matrix_id,
          this.user.user_id,
          changedTime,
          this.matrix.matrix_id,
          this.user.user_id,
          changedTime,
          this.matrix.matrix_id,
          this.user.user_id,
          changedTime,
        ],
      }
    )
    const partitionIds = new Set()
    for (const row of partitionRows) {
      partitionIds.add(parseInt(row.partition_id))
    }

    const partitions = []
    if (partitionIds.size) {
      partitions.push(...(await this.getPartitions(Array.from(partitionIds))))
    }

    return {
      cells: await this.convertCellQueryToResults(cells),
      media: media,
      notes: notes,
      citations: citations,
      characters: characters,
      order: order,
      taxa: taxa,
      character_ids: Array.from(modifiedCharacterIds),
      taxa_ids: Array.from(modifiedTaxaIds),
      partitions: partitions,
    }
  }

  async getPreferences() {
    const preferences = {}
    const projectUser = await models.ProjectsXUser.findOne({
      where: {
        user_id: this.user.user_id,
        project_id: this.project.project_id,
      },
    })

    const matricesPreferences = projectUser
      ? projectUser.getPreferences('matrix')
      : null
    const matrixPrefences = matricesPreferences
      ? matricesPreferences[this.matrix.matrix_id]
      : {}

    for (const key in matrixPrefences) {
      preferences[key] = parseInt(matrixPrefences[key])
    }

    // In v3, we required streaming if the matrix was too large. We need to
    // re-evaluate whether this is needed in v4 since we can load larger
    // matrices.
    preferences['REQUIRE_STREAMING'] = 0

    if (!('DEFAULT_NUMBERING_MODE' in preferences)) {
      preferences['DEFAULT_NUMBERING_MODE'] = parseInt(
        this.matrix.getOption('DEFAULT_NUMBERING_MODE')
      )
    }

    return preferences
  }

  async setPreferences(options, preferences) {
    await this.checkCanDo(
      'setMatrixOptions',
      'You are not allowed to set matrix options'
    )

    const projectUser = await models.ProjectsXUser.findOne({
      where: {
        user_id: this.user.user_id,
        project_id: this.project.project_id,
      },
    })

    if (!projectUser) {
      throw new UserError('You are not a member of this project')
    }

    const adminSettings = ['DISABLE_SCORING', 'ENABLE_CELL_MEDIA_AUTOMATION']
    for (const key in options) {
      if (adminSettings.includes(key) && !(await this.isAdminLike())) {
        continue
      }
      this.matrix.setOption(key, options[key])
    }

    const matricesPreferences = projectUser.getPreferences('matrix') ?? {}
    const matrixPrefences = matricesPreferences[this.matrix.matrix_id] ?? {}

    // Old Preferences which were once supported but should no longer be written
    // to the database.
    const skippedPreferences = ['REQUIRE_STREAMING', 'ENABLE_HTML5']
    const validPreferences = [
      // The number mode which indicates whether the characters/taxa start at
      // zero or one.
      'DEFAULT_NUMBERING_MODE',

      // Whether the user elected that this matrix should stream.
      'ENABLE_STREAMING',

      // How the character names should be displayed (e.g numbers, names,
      // truncated names).
      'MATRIX_VIEW_MODE',

      // Whether we should load the previous view state, default is to enable
      // it.
      'DISABLE_LOAD_SAVED_VIEW_STATE',
    ]

    for (const key in preferences) {
      if (skippedPreferences.includes(key)) {
        delete matrixPrefences[key]
        continue
      }

      if (!validPreferences.includes(key)) {
        throw new UserError('Invalid Matrix Preference: ' + key)
      }

      const value = parseInt(preferences[key]) ?? null
      if (value) {
        matrixPrefences[key] = value
      } else {
        delete matrixPrefences[key]
      }
    }

    if (Object.keys(matrixPrefences).length == 0) {
      delete matricesPreferences[this.matrix.matrix_id]
    }

    projectUser.setPreferences('matrix', matricesPreferences)

    const transaction = await sequelizeConn.transaction()
    await this.matrix.save({ user: this.user, transaction: transaction })
    await projectUser.save({ user: this.user, transaction: transaction })
    await transaction.commit()

    return {
      preferences: matrixPrefences,
      options: options,
    }
  }

  async getCommentCounts() {
    const counts = new Map()

    const [characterCountRows] = await sequelizeConn.query(
      `
      SELECT mco.character_id, count(*) comment_count
      FROM annotations a
      INNER JOIN matrix_character_order AS mco ON mco.character_id = a.row_id
      WHERE a.table_num = 3 AND mco.matrix_id = ?
      GROUP BY mco.character_id`,
      { replacements: [this.matrix.matrix_id] }
    )
    for (const row of characterCountRows) {
      const characterId = parseInt(row.character_id)
      const commentCount = parseInt(row.comment_count)
      counts.set(characterId, commentCount)
    }

    const [stateCountRows] = await sequelizeConn.query(
      `
      SELECT mco.character_id, count(*) comment_count
      FROM annotations a
      INNER JOIN character_states AS cs ON cs.state_id = a.row_id
      INNER JOIN matrix_character_order AS mco ON mco.character_id = cs.character_id
      WHERE a.table_num = 4 AND mco.matrix_id = ?
      GROUP BY mco.character_id`,
      { replacements: [this.matrix.matrix_id] }
    )
    for (const row of stateCountRows) {
      const characterId = parseInt(row.character_id)
      let commentCount = counts.has(characterId) ? counts.get(characterId) : 0
      commentCount += parseInt(row.comment_count)
      counts.set(characterId, commentCount)
    }

    return counts
  }

  async getUnreadCommentCounts() {
    const counts = new Map()

    const [characterCommentCountRows] = await sequelizeConn.query(
      `
      SELECT mco.character_id, count(*) comment_count
      FROM matrix_character_order AS mco
      INNER JOIN annotations AS a ON mco.character_id = a.row_id and a.table_num = 3
      LEFT JOIN annotation_events AS ae ON a.annotation_id = ae.annotation_id AND ae.user_id = ?
      WHERE mco. matrix_id = ? AND ae.event_id IS NULL
      GROUP BY mco.character_id`,
      { replacements: [this.user.user_id, this.matrix.matrix_id] }
    )
    for (const row of characterCommentCountRows) {
      const characterId = parseInt(row.character_id)
      const commentCount = parseInt(row.comment_count)
      counts.set(characterId, commentCount)
    }

    const [stateCommentCountRows] = await sequelizeConn.query(
      `
      SELECT mco.character_id, count(*) comment_count
      FROM matrix_character_order AS mco
      INNER JOIN character_states AS cs ON mco.character_id = cs.character_id
      INNER JOIN annotations AS cs ON cs.state_id = a.row_id
      LEFT JOIN annotation_events AS ae ON a.annotation_id = ae.annotation_id AND ae.user_id = ?
      WHERE mco. matrix_id = ? AND ae.event_id IS NULL
      GROUP BY mco.character_id`,
      { replacements: [this.user.user_id, this.matrix.matrix_id] }
    )
    for (const row of stateCommentCountRows) {
      const characterId = parseInt(row.character_id)
      let commentCount = counts.has(characterId) ? counts.get(characterId) : 0
      commentCount += parseInt(row.comment_count)
      counts.set(characterId, commentCount)
    }

    return counts
  }

  async getCitationCounts() {
    const counts = new Map()
    const [characterCitationCountRows] = await sequelizeConn.query(
      `
      SELECT mco.character_id, count(*) AS citation_count
      FROM characters_x_bibliographic_references AS cxbr
      INNER JOIN matrix_character_order AS mco ON mco.character_id = cxbr.character_id
      WHERE mco.matrix_id = ?
      GROUP BY mco.character_id`,
      { replacements: [this.matrix.matrix_id] }
    )

    for (const row of characterCitationCountRows) {
      const characterId = parseInt(row.character_id)
      const commentCount = parseInt(row.comment_count)
      counts.set(characterId, commentCount)
    }
    return counts
  }

  async getCharactersLastChangeTimes() {
    const [lastChangeTimesRows] = await sequelizeConn.query(
      `
      SELECT mco.character_id, MAX(ccl.changed_on) last_changed_on
      FROM character_change_log ccl
      INNER JOIN matrix_character_order AS mco ON mco.character_id = ccl.character_id
      WHERE mco.matrix_id = ? AND ccl.is_minor_edit = 0
      GROUP BY mco.character_id`,
      { replacements: [this.matrix.matrix_id] }
    )

    const times = new Map()
    for (const row of lastChangeTimesRows) {
      const characterId = parseInt(row.character_id)
      const lastChangedOn = parseInt(row.last_changed_on)
      times.set(characterId, lastChangedOn)
    }
    return times
  }

  async getCharacterLastUserScoringTimes() {
    const [lastScoredTimesRows] = await sequelizeConn.query(
      `
      SELECT ccl.character_id, MAX(ccl.changed_on) AS last_scored_on
      FROM cell_change_log ccl
      INNER JOIN matrix_character_order AS mco ON mco.matrix_id = ccl.matrix_id AND mco.character_id = ccl.character_id
      INNER JOIN matrix_taxa_order AS mto ON mto.matrix_id = ccl.matrix_id AND ccl.taxon_id = mto.taxon_id
      INNER JOIN matrices AS m ON mto.matrix_id = m.matrix_id
      INNER JOIN projects_x_users AS pxu ON pxu.project_id = m.project_id
      LEFT JOIN project_members_x_groups AS pmxg ON pmxg.membership_id = pxu.link_id
      WHERE
        ccl.matrix_id = ? AND pxu.user_id = ? AND
        (mto.group_id = pmxg.group_id OR mto.user_id = ? OR mto.user_id IS NULL OR mto.group_id IS NULL)
      GROUP BY ccl.character_id`,
      {
        replacements: [
          this.matrix.matrix_id,
          this.user.user_id,
          this.user.user_id,
        ],
      }
    )

    const times = new Map()
    for (const row of lastScoredTimesRows) {
      const characterId = parseInt(row.character_id)
      const lastScoredOn = parseInt(row.last_scored_on)
      times.set(characterId, lastScoredOn)
    }
    return times
  }

  async getMediaForTaxa(taxaIds = null) {
    const replacements = [this.matrix.matrix_id]

    let clause = ''
    if (Array.isArray(taxaIds) && taxaIds.length > 0) {
      clause = ' AND mto.taxon_id IN (?)'
      replacements.push(taxaIds)
    }

    if (this.shouldLimitToPublishedData()) {
      clause += ' AND mf.published = 0'
    }

    const [rows] = await sequelizeConn.query(
      `
      SELECT mto.taxon_id, txm.link_id, mf.media_id, mf.media
      FROM taxa_x_media txm
      INNER JOIN media_files AS mf ON mf.media_id = txm.media_id
      INNER JOIN matrix_taxa_order AS mto ON mto.taxon_id = txm.taxon_id
      WHERE mto.matrix_id = ? ${clause}
      ORDER BY mto.taxon_id`,
      { replacements: replacements }
    )

    const media = new Map()
    for (const row of rows) {
      const taxonId = parseInt(row.taxon_id)
      if (!media.has(taxonId)) {
        media.set(taxonId, [])
      }
      media.get(taxonId).push({
        link_id: parseInt(row.link_id),
        taxon_id: taxonId,
        media_id: parseInt(row.media_id),
        tiny: getMedia(row.media, 'tiny'),
      })
    }

    return media
  }

  async getMembers() {
    const [rows] = await sequelizeConn.query(
      `
        SELECT u.user_id, u.email, u.fname, u.lname, pxu.membership_type, pxu.color
        FROM ca_users u
        INNER JOIN projects_x_users AS pxu ON pxu.user_id = u.user_id
        WHERE pxu.project_id = ? AND active = 1
        ORDER BY u.lname, u.fname`,
      { replacements: [this.project.project_id] }
    )
    return rows
  }

  async getUploadedTimes() {
    const [rows] = await sequelizeConn.query(
      'SELECT uploaded_on FROM matrix_file_uploads WHERE matrix_id = ?',
      { replacements: [this.matrix.matrix_id] }
    )

    const uploadTimes = []
    for (const row of rows) {
      uploadTimes.push(parseInt(row.uploaded_on))
    }
    return uploadTimes
  }

  async getMemberGroups() {
    const [rows] = await sequelizeConn.query(
      'SELECT * FROM project_member_groups WHERE project_id = ?',
      { replacements: [this.project.project_id] }
    )
    return rows
  }

  async getUserMemberGroups() {
    const [rows] = await sequelizeConn.query(
      `
      SELECT pmg.group_id
      FROM projects_x_users AS pu
      INNER JOIN project_members_x_groups AS pmg ON pmg.membership_id = pu.link_id
      WHERE pu.project_id = ? AND pu.user_id = ?`,
      { replacements: [this.project.project_id, this.user.user_id] }
    )
    return rows.map((row) => parseInt(row.group_id))
  }

  async isAdminLike() {
    if (this.project.user_id == this.user.user_id) {
      return true
    }
    if (this.matrix.user_id == this.user.user_id) {
      return true
    }
    const roles = await this.getRoles()
    return roles.includes('admin')
  }

  async getCellsStates(taxaIds, characterIds) {
    const stateIds = new HyperTable()
    if (taxaIds.length == 0 || characterIds.length == 0) {
      return stateIds
    }

    const [rows] = await sequelizeConn.query(
      `
        SELECT
          cell_id, taxon_id, character_id, state_id, is_npa, is_uncertain,
          start_value, end_value, created_on, user_id
        FROM cells
        WHERE matrix_id = ? AND character_id IN (?) AND taxon_id IN (?)`,
      { replacements: [this.matrix.matrix_id, characterIds, taxaIds] }
    )
    for (const row of rows) {
      const isNPA = parseInt(row.is_npa)
      const isUncertain = parseInt(row.is_uncertain)
      const characterId = parseInt(row.character_id)
      const taxonId = parseInt(row.taxon_id)
      const stateId =
        row.state_id == null ? (isNPA ? -1 : 0) : parseInt(row.state_id)
      const cell = {
        cell_id: parseInt(row.cell_id),
        taxon_id: taxonId,
        character_id: characterId,
        state_id: stateId,
        user_id: parseInt(row.user_id),
        created_on: parseInt(row.created_on),
        is_npa: isNPA,
        is_uncertain: isUncertain,
        start_value: row.start_value,
        end_value: row.end_value,
      }
      stateIds.set(taxonId, characterId, stateId, cell)
    }

    return stateIds
  }

  async searchTaxa(partitionId, limitToUnscoredCells, limitToNPACells) {
    let taxaPartitionClause = ''
    let characterPartitionClause = ''
    const replacements = []
    if (partitionId) {
      taxaPartitionClause = `
        INNER JOIN taxa_x_partitions AS txp ON
          txp.taxon_id = mto.taxon_id AND
          txp.partition_id = ?`
      characterPartitionClause = `
        INNER JOIN characters_x_partitions AS cxp ON
          cxp.character_id = mco.character_id AND
          cxp.partition_id = ?`
      replacements.push(partitionId, partitionId)
    }

    let sql
    if (limitToUnscoredCells) {
      sql = `
        SELECT fm.taxon_id
        FROM(
          SELECT mto.position, mto.taxon_id
            FROM matrix_taxa_order mto
            ${taxaPartitionClause}
            INNER JOIN cells AS c ON c.matrix_id = mto.matrix_id AND c.taxon_id = mto.taxon_id
            WHERE mto.matrix_id = ${this.matrix.matrix_id}
            GROUP BY c.character_id, c.taxon_id
        ) AS fm
          GROUP BY fm.taxon_id
          HAVING count(*) < (
          SELECT count(*)
            FROM matrix_character_order mco
            ${characterPartitionClause}
            WHERE mco.matrix_id = ${this.matrix.matrix_id}
          )
          ORDER BY fm.position`
    } else if (limitToNPACells) {
      sql = `
        SELECT mto.taxon_id
        FROM matrix_taxa_order mto
        ${taxaPartitionClause}
        INNER JOIN cells AS c ON
          c.taxon_id = mto.taxon_id AND
          c.matrix_id = mto.matrix_id
        INNER JOIN matrix_character_order AS mco ON
          mco.character_id = c.character_id AND
          mco.matrix_id = c.matrix_id
        ${characterPartitionClause}
        WHERE c.is_npa = 1 AND mto.matrix_id = ${this.matrix.matrix_id}
        GROUP BY mto.taxon_id
        ORDER BY mto.position`
    } else {
      throw new UserError('Invalid search option')
    }

    const [rows] = await sequelizeConn.query(sql, {
      replacements: replacements,
    })

    const results = []
    for (const row of rows) {
      results.push({
        taxon_id: row.taxon_id,
      })
    }
    return {
      results: results,
    }
  }

  async searchCells(
    partitionId,
    taxonId,
    limitToUnscoredCells,
    limitToScoredCells,
    limitToUndocumentedCells,
    limitToNPACells,
    limitToPolymorphicCells,
    limitToUnimagedCells
  ) {
    let taxaPartitionClause = ''
    let characterPartitionClause = ''
    const replacements = []
    if (partitionId) {
      taxaPartitionClause = `
        INNER JOIN taxa_x_partitions AS txp ON
          txp.taxon_id = mto.taxon_id AND
          txp.partition_id = ${partitionId}`
      characterPartitionClause = `
        INNER JOIN characters_x_partitions AS cxp ON
          cxp.character_id = mco.character_id AND
          cxp.partition_id = ${partitionId}`
      replacements.push(partitionId, partitionId)
    }

    let clause = ''
    if (taxonId) {
      clause += 'mto.taxon_id = ? AND'
      replacements.push(taxonId)
    }

    let sql
    if (
      limitToScoredCells &&
      limitToUndocumentedCells &&
      limitToUnimagedCells
    ) {
      sql = `
        SELECT c.character_id, c.taxon_id
        FROM cells c
        INNER JOIN matrix_taxa_order AS mto ON
          mto.taxon_id = c.taxon_id AND
          mto.matrix_id = c.matrix_id
        ${taxaPartitionClause}
        INNER JOIN matrix_character_order AS mco ON
          mco.character_id = c.character_id AND
          mco.matrix_id = mto.matrix_id
        ${characterPartitionClause}
        LEFT JOIN cells_x_media AS cxm ON
          cxm.taxon_id = mto.taxon_id AND
          cxm.character_id = mco.character_id AND
          cxm.matrix_id = mto.matrix_id
        LEFT JOIN cell_notes AS cn ON
          cn.taxon_id = mto.taxon_id AND
          cn.character_id = mco.character_id AND
          cn.matrix_id = mto.matrix_id
        LEFT JOIN cells_x_bibliographic_references AS cxbr ON
          cxbr.taxon_id = mto.taxon_id AND
          cxbr.character_id = mco.character_id AND
          cxbr.matrix_id = mto.matrix_id
        WHERE
          cxm.taxon_id IS NULL AND cxm.character_id IS NULL AND
          ((cn.taxon_id IS NULL AND cn.character_id IS NULL) OR cn.notes = '') AND
          cxbr.taxon_id IS NULL AND cxbr.character_id IS NULL AND
          c.is_npa = 0 AND
          c.state_id IS NOT NULL AND
          ${clause}
          c.matrix_id = ${this.matrix.matrix_id}
          GROUP BY mco.character_id, mto.taxon_id
          ORDER BY mco.position, mto.position`
    } else if (limitToUndocumentedCells && limitToUnimagedCells) {
      sql = `
        SELECT mco.character_id, mto.taxon_id
        FROM cells c
        INNER JOIN matrix_taxa_order AS mto ON
          mto.taxon_id = c.taxon_id AND
          mto.matrix_id = c.matrix_id
        ${taxaPartitionClause}
        INNER JOIN matrix_character_order AS mco ON
          mco.character_id = c.character_id AND
          mco.matrix_id = mto.matrix_id
        ${characterPartitionClause}
        LEFT JOIN cells_x_media AS cxm ON
          cxm.taxon_id = mto.taxon_id AND
          cxm.character_id = mco.character_id AND
          cxm.matrix_id = mto.matrix_id
        LEFT JOIN cell_notes AS cn ON
          cn.taxon_id = mto.taxon_id AND
          cn.character_id = mco.character_id AND
          cn.matrix_id = mto.matrix_id
        LEFT JOIN cells_x_bibliographic_references AS cxbr ON
          cxbr.taxon_id = mto.taxon_id AND
          cxbr.character_id = mco.character_id AND
          cxbr.matrix_id = mto.matrix_id
        WHERE
          (cxm.taxon_id IS NULL AND cxm.character_id IS NULL AND cxm.matrix_id IS NULL) AND
          ((cn.taxon_id IS NULL AND cn.character_id IS NULL AND cn.matrix_id IS NULL) OR cn.notes = '') AND
          (cxbr.taxon_id IS NULL AND cxbr.character_id IS NULL AND cxbr.matrix_id IS NULL) AND
          ${clause}
          c.matrix_id = ${this.matrix.matrix_id}
        GROUP BY mco.character_id, mto.taxon_id
        ORDER BY mco.position, mto.position`
    } else if (limitToUnscoredCells) {
      sql = `
        SELECT mco.character_id, mto.taxon_id
        FROM matrix_taxa_order mto
        ${taxaPartitionClause}
        INNER JOIN matrix_character_order AS mco ON
          mco.matrix_id = mto.matrix_id
        ${characterPartitionClause}
        LEFT JOIN cells AS c ON
          c.taxon_id = mto.taxon_id AND
          c.character_id = mco.character_id AND
          c.matrix_id = mto.matrix_id
        WHERE
          (c.taxon_id IS NULL AND c.character_id IS NULL AND c.matrix_id IS NULL) AND
          ${clause}
          mto.matrix_id = ${this.matrix.matrix_id}
        GROUP BY mco.character_id, mto.taxon_id
        ORDER BY mco.position, mto.position`
    } else if (limitToNPACells) {
      sql = `
        SELECT mco.character_id, mto.taxon_id
        FROM cells c
        INNER JOIN matrix_taxa_order AS mto ON
          mto.taxon_id = c.taxon_id AND
          mto.matrix_id = c.matrix_id
        ${taxaPartitionClause}
        INNER JOIN matrix_character_order AS mco ON
          mco.character_id = c.character_id AND
          mto.matrix_id = c.matrix_id
        ${characterPartitionClause}
        WHERE
          c.is_npa = 1 AND
          ${clause}
          mto.matrix_id = ${this.matrix.matrix_id}
        GROUP BY mco.position, mto.position, mco.character_id, mto.taxon_id
        ORDER BY mco.position, mto.position`
    } else if (limitToUnimagedCells) {
      sql = `
        SELECT mco.character_id, mto.taxon_id
        FROM matrix_taxa_order mto
        ${taxaPartitionClause}
        INNER JOIN matrix_character_order AS mco ON
          mco.matrix_id = mto.matrix_id
        ${characterPartitionClause}
        LEFT JOIN cells_x_media AS cxm ON
          cxm.taxon_id = mto.taxon_id AND
          cxm.character_id = mco.character_id AND
          cxm.matrix_id = mto.matrix_id
        WHERE
          cxm.taxon_id IS NULL AND
          cxm.character_id IS NULL AND
          ${clause}
          mto.matrix_id = ${this.matrix.matrix_id}
        GROUP BY mco.character_id, mto.taxon_id
        ORDER BY mco.position, mto.position`
    } else if (limitToPolymorphicCells) {
      sql = `
       SELECT c.matrix_id, c.character_id, c.taxon_id
        FROM cells AS c
        INNER JOIN matrix_taxa_order mto ON
          mto.matrix_id = c.matrix_id AND
          mto.taxon_id = c.taxon_id
        ${taxaPartitionClause}
        INNER JOIN matrix_character_order AS mco ON
          mco.matrix_id = c.matrix_id AND
          mco.character_id = c.character_id
        ${characterPartitionClause}
        WHERE
          ${clause}
          c.matrix_id = ${this.matrix.matrix_id}
        GROUP BY c.matrix_id, c.character_id, c.taxon_id
        HAVING COUNT(*) > 1 AND COUNT(*) > COUNT(c.state_id)
        ORDER BY mco.position, mto.position`
    } else {
      throw new UserError('Invalid search option')
    }

    const [rows] = await sequelizeConn.query(sql, {
      replacements: replacements,
    })

    const results = []
    for (const row of rows) {
      results.push({
        character_id: row.character_id,
        taxon_id: row.taxon_id,
      })
    }
    return {
      results: results,
    }
  }

  async searchCharacters(
    partitionId,
    limitToUnscoredCells,
    limitToUnusedMedia,
    limitToNPACells
  ) {
    let taxaPartitionClause = ''
    let characterPartitionClause = ''
    const replacements = []
    if (partitionId) {
      taxaPartitionClause = `
        INNER JOIN taxa_x_partitions AS txp ON
          txp.taxon_id = mto.taxon_id AND
          txp.partition_id = ${partitionId}`
      characterPartitionClause = `
        INNER JOIN characters_x_partitions AS cxp ON
          cxp.character_id = mco.character_id AND
          cxp.partition_id = ${partitionId}`
      replacements.push(partitionId, partitionId)
    }

    let sql
    if (limitToUnscoredCells) {
      sql = `
        SELECT fm.character_id
        FROM(
          SELECT mco.position, mco.character_id
            FROM matrix_character_order mco
            ${characterPartitionClause}
            INNER JOIN cells AS c ON c.matrix_id = mco.matrix_id AND c.character_id = mco.character_id
            WHERE mco.matrix_id = ${this.matrix.matrix_id}
            GROUP BY c.character_id, c.taxon_id
        ) AS fm
        GROUP BY fm.character_id
        HAVING count(*) < (
          SELECT count(*)
          FROM matrix_taxa_order mto
          ${taxaPartitionClause}
          WHERE mto.matrix_id = ${this.matrix.matrix_id}
        )
        ORDER BY fm.position`
    } else if (limitToNPACells) {
      sql = `
        SELECT mco.character_id
        FROM matrix_character_order mco
        ${characterPartitionClause}
        INNER JOIN cells AS c ON
          c.character_id = mco.character_id AND
          c.matrix_id = mco.matrix_id
        INNER JOIN matrix_taxa_order AS mto ON
          mto.taxon_id = c.taxon_id AND
          mto.matrix_id = c.matrix_id
        ${taxaPartitionClause}
        WHERE
          c.is_npa = 1 AND
          mco.matrix_id = ${this.matrix.matrix_id}
        GROUP BY mco.character_id
        ORDER BY mco.position`
    } else if (limitToUnusedMedia) {
      sql = `
        SELECT
          mco.character_id,
          GROUP_CONCAT(DISTINCT chm.media_id ORDER BY chm.media_id SEPARATOR '; M') AS media_list
        FROM matrix_character_order mco
        ${characterPartitionClause}
        INNER JOIN characters_x_media AS chm ON
          chm.character_id = mco.character_id
        LEFT JOIN cells_x_media AS cxm ON
          cxm.character_id = mco.character_id AND
          cxm.matrix_id = mco.matrix_id AND
          chm.media_id = cxm.media_id
        WHERE
          cxm.character_id IS NULL AND
          mco.matrix_id = ${this.matrix.matrix_id}
        GROUP BY mco.character_id
        ORDER BY mco.position`
      const [rows] = await sequelizeConn.query(sql, {
        replacements: replacements.splice(1),
      })

      const results = []
      for (const row of rows) {
        results.push({
          character_id: row.character_id,
          media_list: '; M' + row.media_list,
        })
      }
      return {
        results: results,
      }
    } else {
      throw new UserError('Invalid search option')
    }

    const [rows] = await sequelizeConn.query(sql, {
      replacements: replacements,
    })

    const results = []
    for (const row of rows) {
      results.push({
        character_id: row.character_id,
      })
    }
    return {
      results: results,
    }
  }

  async applyStateRules(scores, transaction) {
    if (scores.length == 0) {
      return []
    }

    const characterIds = Array.from(
      new Set(scores.map((score) => parseInt(score.character_id)))
    )
    const taxonIds = Array.from(
      new Set(scores.map((score) => parseInt(score.taxon_id)))
    )

    const [rulesRows] = await sequelizeConn.query(
      `
        SELECT
          cr.rule_id, cr.character_id, cr.state_id, cra.character_id action_character_id,
          cra.state_id action_state_id, cra.action
        FROM character_rules cr
        INNER JOIN character_rule_actions AS cra ON cr.rule_id = cra.rule_id
        WHERE cr.character_id IN (?) AND cra.action = "SET_STATE"`,
      { replacements: [characterIds], transaction: transaction }
    )
    const scoresRules = new Table()
    const actionCharacterIds = []
    for (const row of rulesRows) {
      const characterId = parseInt(row.character_id)
      const actionCharacterId = parseInt(row.action_character_id)
      const stateId = row.state_id == null ? 0 : parseInt(row.state_id)
      if (!scoresRules.has(characterId, stateId)) {
        scoresRules.set(characterId, stateId, [])
      }
      scoresRules.get(characterId, stateId).push(row)
      actionCharacterIds.push(actionCharacterId)
    }

    const ruleBasedChanges = []
    const allowOverwritingByRules = this.matrix.getOption(
      'ALLOW_OVERWRITING_BY_RULES'
    )
    const existingScores = await this.getCellsStates(
      taxonIds,
      actionCharacterIds
    )
    for (const score of scores) {
      const characterId = parseInt(score.character_id)
      const taxonId = parseInt(score.taxon_id)
      const stateId =
        score.state_id == null
          ? score.is_npa
            ? -1
            : 0
          : parseInt(score.state_id)
      const scoreRules = scoresRules.get(characterId, stateId)
      if (!scoreRules) {
        continue
      }

      for (const rule of scoreRules) {
        const actionCharacterId = parseInt(rule.action_character_id)
        const existingScore = existingScores.get(taxonId, actionCharacterId)

        if (existingScore && existingScore.size > 0) {
          if (!allowOverwritingByRules) {
            continue
          }
          const cellIds = Array.from(existingScore.values()).map((score) =>
            parseInt(score.cell_id)
          )
          await models.Cell.destroy({
            where: { cell_id: cellIds },
            transaction: transaction,
            individualHooks: true,
            user: this.user,
          })
        }

        const actionStateId =
          rule.action_state_id == null ? null : parseInt(rule.action_state_id)
        const cell = await models.Cell.create(
          {
            matrix_id: this.matrix.matrix_id,
            taxon_id: taxonId,
            character_id: actionCharacterId,
            user_id: this.user.user_id,
            state_id: actionStateId,
            is_npa: 0,
            is_uncertain: score.is_uncertain,
          },
          { user: this.user, transaction: transaction }
        )
        ruleBasedChanges.push(cell)
      }
    }

    return ruleBasedChanges
  }

  async applyMediaRules(cellMedia, transaction) {
    if (cellMedia.length == 0) {
      return []
    }

    const characterIds = Array.from(
      new Set(cellMedia.map((m) => parseInt(m.character_id)))
    )

    const [rows] = await sequelizeConn.query(
      `
        SELECT
          cr.character_id, cra.character_id action_character_id
        FROM character_rules cr
        INNER JOIN character_rule_actions AS cra ON cr.rule_id = cra.rule_id
        WHERE cr.character_id IN (?) AND cra.action = 'ADD_MEDIA'`,
      { replacements: [characterIds], transaction: transaction }
    )

    if (rows.length == 0) {
      return []
    }

    const mediaRules = new Map()
    for (const row of rows) {
      const characterId = parseInt(row.character_id)
      const actionCharacterId = parseInt(row.action_character_id)
      if (!mediaRules.has(characterId)) {
        mediaRules.set(characterId, [])
      }
      mediaRules.get(characterId).push(actionCharacterId)
    }

    const insertedCellMedia = []
    for (const cellMedium of cellMedia) {
      const mediaId = parseInt(cellMedium.media_id)
      const characterId = parseInt(cellMedium.character_id)
      const actionCharacterIds = mediaRules.get(characterId)
      if (!actionCharacterIds) {
        continue
      }
      for (const actionCharacterId of actionCharacterIds) {
        const [newCellMedium, created] = await models.CellsXMedium.findOrCreate(
          {
            where: {
              matrix_id: this.matrix.matrix_id,
              taxon_id: cellMedium.taxon_id,
              character_id: actionCharacterId,
              media_id: mediaId,
            },
            defaults: {
              matrix_id: this.matrix.matrix_id,
              taxon_id: cellMedium.taxon_id,
              character_id: actionCharacterId,
              media_id: mediaId,
              source: 'HTML5',
            },
            transaction: transaction,
            user: this.user,
          }
        )
        if (created) {
          insertedCellMedia.push(newCellMedium)
        }
      }
    }
    return insertedCellMedia
  }

  async copyMediaCitationsToCell(cellMedia, transaction) {
    const [rows] = await sequelizeConn.query(
      `
      SELECT mfxbr.media_id, mfxbr.reference_id, cxm.taxon_id, cxm.character_id, cxm.matrix_id
      FROM cells_x_media cxm
      INNER JOIN media_files AS mf ON mf.media_id = cxm.media_id
      INNER JOIN media_files_x_bibliographic_references AS mfxbr ON cxm.media_id = mfxbr.media_id
      INNER JOIN matrices AS m ON m.matrix_id = cxm.matrix_id AND m.project_id = mf.project_id
      INNER JOIN matrix_taxa_order AS mto ON mto.matrix_id = cxm.matrix_id AND mto.taxon_id = cxm.taxon_id
      INNER JOIN matrix_character_order AS mco ON mco.matrix_id = cxm.matrix_id AND mco.character_id = cxm.character_id
      INNER JOIN taxa AS t ON t.taxon_id = cxm.taxon_id
      INNER JOIN characters AS c ON c.character_id = cxm.character_id
      LEFT JOIN cells_x_bibliographic_references AS cxbr ON
        cxbr.taxon_id = cxm.taxon_id AND
        cxbr.character_id = cxm.character_id AND
        cxbr.matrix_id = cxm.matrix_id AND
        cxbr.reference_id = mfxbr.reference_id
      INNER JOIN bibliographic_references AS br ON br.reference_id = mfxbr.reference_id
      WHERE
        cxbr.link_id IS NULL AND cxm.link_id = ?`,
      { replacements: [cellMedia.link_id], transaction: transaction }
    )

    if (rows.length == 0) {
      return
    }

    for (const row of rows) {
      await models.CellsXBibliographicReference.create(
        {
          matrix_id: this.matrix.matrix_id,
          taxon_id: row.taxon_id,
          character_id: row.character_id,
          reference_id: row.reference_id,
          user_id: this.user.user_id,
          source: 'HTML5',
        },
        { user: this.user, transaction: transaction }
      )
    }
  }

  async cellMediaToDeleteFromCharacterView(taxaIds, characterIds) {
    const goodCellMedia = []
    const deletedCellMedia = []
    // delete NPA or "-" cells
    const [npaCellsRows] = await sequelizeConn.query(
      `
      SELECT
        cxm.link_id, cxm.media_id, cxm.taxon_id, cxm.character_id
      FROM cells_x_media AS cxm
      INNER JOIN matrices AS m ON m.matrix_id = cxm.matrix_id
      INNER JOIN media_files AS mf ON mf.media_id = cxm.media_id AND mf.project_id = m.project_id
      INNER JOIN cells AS c ON c.taxon_id = cxm.taxon_id AND c.character_id = cxm.character_id AND c.matrix_id = cxm.matrix_id
      INNER JOIN matrix_taxa_order AS mto ON mto.matrix_id = c.matrix_id AND mto.taxon_id = c.taxon_id
      INNER JOIN projects_x_users AS pxu ON m.project_id = pxu.project_id
      LEFT JOIN project_members_x_groups AS pmxg ON pmxg.membership_id = pxu.link_id
      WHERE
        (c.state_id IS NULL OR c.is_npa = 1) AND
        pxu.user_id = ? AND cxm.matrix_id = ? AND cxm.set_by_automation = 1 AND
        (mto.group_id = pmxg.group_id OR mto.user_id IS NULL OR mto.group_id IS NULL OR mto.user_id = pxu.user_id) AND
        cxm.taxon_id IN (?) AND cxm.character_id IN (?)`,
      {
        replacements: [
          this.user.user_id,
          this.matrix.matrix_id,
          taxaIds,
          characterIds,
        ],
      }
    )
    deletedCellMedia.push(...npaCellsRows)

    const [scoredCellsRows] = await sequelizeConn.query(
      `
      SELECT
        mf.media_id, mto.taxon_id, mco.character_id
      FROM matrix_character_order mco
      INNER JOIN matrix_taxa_order AS mto ON mto.matrix_id = mco.matrix_id
      INNER JOIN character_states AS cs ON cs.character_id = mco.character_id
      INNER JOIN cells AS cl ON cl.character_id = mco.character_id AND cl.matrix_id = mco.matrix_id AND cl.taxon_id = mto.taxon_id AND cl.state_id = cs.state_id
      INNER JOIN characters_x_media AS csxm ON csxm.character_id = mco.character_id AND csxm.state_id = cs.state_id
      INNER JOIN matrices AS m ON m.matrix_id = mto.matrix_id
      INNER JOIN media_files AS mf2v ON csxm.media_id = mf2v.media_id AND mf2v.project_id = m.project_id
      INNER JOIN taxa_x_specimens AS txs ON txs.taxon_id = mto.taxon_id
      INNER JOIN media_files AS mf ON mf.view_id = mf2v.view_id AND mf.specimen_id = txs.specimen_id
      WHERE
        mco.matrix_id = ? AND mto.taxon_id IN (?) AND mco.character_id IN (?) AND
        cl.is_npa = 0 AND cl.state_id IS NOT NULL`,
      { replacements: [this.matrix.matrix_id, taxaIds, characterIds] }
    )
    goodCellMedia.push(...scoredCellsRows)

    // respect ontology rules:
    if (this.matrix.getOption('APPLY_CHARACTERS_WHILE_SCORING') == '1') {
      const [ontologyRulesRows] = await sequelizeConn.query(
        `
          SELECT
            mf.media_id, mto.taxon_id, cra.character_id
          FROM matrix_character_order mco
          INNER JOIN matrix_taxa_order AS mto ON mto.matrix_id = mco.matrix_id
          INNER JOIN matrices AS m ON m.matrix_id = mco.matrix_id
          INNER JOIN character_states AS cs ON cs.character_id = mco.character_id
          INNER JOIN cells AS cl ON cl.character_id = mco.character_id AND cl.matrix_id = mco.matrix_id AND cl.taxon_id = mto.taxon_id AND cl.state_id = cs.state_id
          INNER JOIN characters_x_media AS csxm ON csxm.character_id = mco.character_id AND csxm.state_id = cs.state_id
          INNER JOIN media_files AS mf2v ON csxm.media_id = mf2v.media_id AND mf2v.project_id = m.project_id
          INNER JOIN taxa_x_specimens AS txs ON txs.taxon_id = mto.taxon_id
          INNER JOIN media_files AS mf ON mf.view_id = mf2v.view_id AND mf.specimen_id = txs.specimen_id AND mf.project_id = m.project_id
          INNER JOIN character_rules AS cr ON cr.character_id = csxm.character_id AND cr.state_id IS NULL
          INNER JOIN character_rule_actions AS cra ON cr.rule_id = cra.rule_id AND cra.action = 'ADD_MEDIA'
          INNER JOIN matrix_character_order AS mcoa ON mcoa.character_id = cra.character_id AND mcoa.matrix_id = mco.matrix_id
          WHERE mco.matrix_id = ? AND mto.taxon_id IN (?) AND mco.character_id IN (?)`,
        { replacements: [this.matrix.matrix_id, taxaIds, characterIds] }
      )
      goodCellMedia.push(...ontologyRulesRows)
    }

    const [unscoredCellsRows] = await sequelizeConn.query(
      `
      SELECT mf.media_id, mto.taxon_id, mco.character_id
      FROM matrix_character_order mco
      INNER JOIN matrix_taxa_order AS mto ON mto.matrix_id = mco.matrix_id
      INNER JOIN matrices AS m ON m.matrix_id = mto.matrix_id
      LEFT JOIN cells AS cl ON cl.character_id = mco.character_id AND cl.matrix_id = mco.matrix_id AND cl.taxon_id = mto.taxon_id
      INNER JOIN characters_x_media AS csxm ON csxm.character_id = mco.character_id
      INNER JOIN media_files AS mf2v ON mf2v.media_id = csxm.media_id AND m.project_id = mf2v.project_id
      INNER JOIN taxa_x_specimens AS txs ON txs.taxon_id = mto.taxon_id
      INNER JOIN media_files AS mf ON mf.view_id = mf2v.view_id AND mf.specimen_id = txs.specimen_id AND m.project_id = mf.project_id
      WHERE mco.matrix_id = ? AND mto.taxon_id IN (?) AND mco.character_id IN (?) AND cl.cell_id IS NULL`,
      { replacements: [this.matrix.matrix_id, taxaIds, characterIds] }
    )
    goodCellMedia.push(...unscoredCellsRows)

    // Get all cells media that which was used in cell automation and user has access to.
    const [oldCellsRows] = await sequelizeConn.query(
      `
      SELECT
        cxm.link_id, cxm.media_id, cxm.taxon_id, cxm.character_id
      FROM cells_x_media AS cxm
      INNER JOIN cells AS c ON c.taxon_id = cxm.taxon_id AND c.character_id = cxm.character_id AND c.matrix_id = cxm.matrix_id
      INNER JOIN matrix_taxa_order AS mto ON mto.matrix_id = c.matrix_id AND cxm.taxon_id = c.taxon_id
      INNER JOIN matrices AS m ON mto.matrix_id = m.matrix_id
      INNER JOIN media_files AS mf ON mf.media_id = cxm.media_id AND mf.project_id = m.project_id
      INNER JOIN projects_x_users AS pxu ON m.project_id = pxu.project_id AND pxu.user_id = ?
      LEFT JOIN project_members_x_groups AS pmxg ON pmxg.membership_id = pxu.link_id
      WHERE
        cxm.matrix_id = ? AND cxm.set_by_automation = 1 AND
        (mto.group_id = pmxg.group_id OR mto.user_id IS NULL OR mto.group_id IS NULL OR mto.user_id = ?) AND
        cxm.taxon_id IN (?) AND cxm.character_id IN (?)`,
      {
        replacements: [
          this.user.user_id,
          this.matrix.matrix_id,
          this.user.user_id,
          taxaIds,
          characterIds,
        ],
      }
    )

    outer: for (const row of oldCellsRows) {
      for (const good of goodCellMedia) {
        if (
          row.media_id == good.media_id &&
          row.taxon_id == good.taxon_id &&
          row.character_id == good.character_id
        ) {
          continue outer
        }
      }
      deletedCellMedia.push(row)
    }

    return deletedCellMedia
  }

  async convertCellQueryToResults(rows) {
    const cells = []
    if (rows.length == 0) {
      return cells
    }

    const characterIds = rows.map((row) => row.character_id)
    const characterTypeMap = await getTypesForCharacterIds(characterIds)
    for (const row of rows) {
      const taxonId = parseInt(row.taxon_id)
      const characterId = parseInt(row.character_id)
      const cellId = parseInt(row.cell_id)

      // This represents a deleted scores so that the client can remove it from
      // its model.
      if (cellId == 0) {
        cells.push({
          id: cellId,
          tid: taxonId,
          cid: characterId,
        })
        continue
      }

      const cell = {
        id: parseInt(row.cell_id),
        tid: taxonId,
        cid: characterId,
        uid: parseInt(row.user_id),
        c: parseInt(row.created_on),
      }
      const stateId = parseInt(row.state_id)
      if (stateId) {
        cell['sid'] = stateId
      }
      if (row.is_npa) {
        cell['npa'] = 1
      }
      if (row.is_uncertain) {
        cell['uct'] = 1
      }
      // This is a shortcut to evaluate discrete characters to false and
      // continuous and mestric characters to true since they are numeric.
      const type = characterTypeMap.get(characterId)
      if (type) {
        const convertFunction = parseInt(type) == 1 ? parseFloat : parseInt
        if (row.start_value != null) {
          cell['sv'] = convertFunction(row.start_value)
        }
        if (row.end_value != null) {
          cell['ev'] = convertFunction(row.end_value)
        }
      }
      cells.push(cell)
    }
    return cells
  }

  async checkCanDo(action, message) {
    const actions = await this.getUserAllowableActions()
    if (!actions.includes(action)) {
      throw new ForbiddenError(message)
    }
  }

  async getUserAllowableActions() {
    // If this project is published, the user is not allowed to perform any action.
    if (this.project.status > 0) {
      return []
    }
    const [rows] = await sequelizeConn.query(
      'SELECT membership_type FROM projects_x_users WHERE project_id = ? AND user_id = ?',
      { replacements: [this.project.project_id, this.user.user_id] }
    )
    if (rows.length == 0) {
      return []
    }

    const membershipType = parseInt(rows[0].membership_type)
    switch (membershipType) {
      case 0: // full user
        return FULL_USER_CAPABILITIES
      case 1: // observer
        return OBSERVER_CAPABILITES
      case 2: // char limitation
        return CHARACTER_ANNOTATOR_CAPABILITIES
      case 3: // bibliography maintainer
      case 4: // anonymous user
      default:
        return []
    }
  }

  async logMatrixChange(transaction) {
    const time = parseInt(Date.now() / 1000)
    await sequelizeConn.query(
      `
      INSERT INTO ca_change_log(
        log_datetime, user_id, unit_id, changetype, rolledback,
        logged_table_num, logged_row_id)
      VALUES(?, ?, ?, ?, 0, 5, ?)`,
      {
        replacements: [
          time,
          this.user.user_id,
          null,
          'U',
          this.matrix.matrix_id,
        ],
        transaction: transaction,
      }
    )
  }

  async getTaxonMedia() {
    const [rows] = await sequelizeConn.query(
      `
      SELECT txm.link_id, t.taxon_id, mf.media_id, mf.media
      FROM taxa_x_media txm
      INNER JOIN media_files AS mf ON mf.media_id = txm.media_id
      INNER JOIN taxa AS t ON t.taxon_id = txm.taxon_id
      WHERE mf.project_id = ?
      ORDER BY t.taxon_id`,
      { replacements: [this.project.project_id] }
    )

    const media = new Map()
    for (const row of rows) {
      const taxonId = parseInt(row.taxon_id)
      if (!media.has(taxonId)) {
        media.set(taxonId, [])
      }
      media.get(taxonId).push({
        taxon_id: taxonId,
        link_id: parseInt(row.link_id),
        media_id: parseInt(row.media_id),
        tiny: getMedia(row.media, 'tiny'),
      })
    }
    return media
  }

  async checkTaxaInProject(taxaIds) {
    const [[{ count }]] = await sequelizeConn.query(
      `
      SELECT COUNT(taxon_id) AS count
      FROM taxa
      WHERE project_id = ? AND taxon_id IN (?)`,
      {
        replacements: [this.project.project_id, taxaIds],
      }
    )
    if (count != taxaIds.length) {
      throw new ForbiddenError(
        'The requested taxa are not in the current project'
      )
    }
  }

  async checkCharactersInProject(characterIds) {
    const [[{ count }]] = await sequelizeConn.query(
      `
      SELECT COUNT(character_id) AS count
      FROM characters
      WHERE project_id = ? AND character_id IN (?)`,
      {
        replacements: [this.project.project_id, characterIds],
      }
    )
    if (count != characterIds.length) {
      throw new ForbiddenError(
        'The requested characters are not in the current project'
      )
    }
  }

  async checkCanEditTaxa(taxaIds) {
    const [[{ count }]] = await sequelizeConn.query(
      `
      SELECT COUNT(DISTINCT mto.taxon_id) AS count
      FROM matrix_taxa_order mto
      INNER JOIN matrices AS m ON mto.matrix_id = m.matrix_id
      INNER JOIN projects_x_users AS pxu ON m.project_id = pxu.project_id
      LEFT JOIN project_members_x_groups AS pmxg ON pmxg.membership_id = pxu.link_id
      WHERE
        m.matrix_id = ? AND pxu.user_id = ? AND mto.taxon_id IN (?) AND
        (mto.group_id = pmxg.group_id OR mto.group_id IS NULL OR mto.user_id IS NULL OR mto.user_id = ?)`,
      {
        replacements: [
          this.matrix.matrix_id,
          this.user.user_id,
          taxaIds,
          this.user.user_id,
        ],
      }
    )
    if (count != taxaIds.length) {
      throw new ForbiddenError(
        'You are not allowed to modify the selected taxa'
      )
    }
  }

  async checkCanEditCharacters(characterIds) {
    const [[{ count }]] = await sequelizeConn.query(
      `
      SELECT COUNT(mco.character_id) AS count
      FROM matrix_character_order mco
      INNER JOIN characters AS c ON mco.character_id = c.character_id
      INNER JOIN matrices AS m ON mco.matrix_id = m.matrix_id AND c.project_id = m.project_id
      WHERE m.matrix_id = ? AND mco.character_id IN (?)`,
      { replacements: [this.matrix.matrix_id, characterIds] }
    )
    if (count != characterIds.length) {
      throw new ForbiddenError(
        'User does not have access to edit all characters'
      )
    }
  }

  async checkCharactersAreDiscrete(characterIds) {
    const [[{ count }]] = await sequelizeConn.query(
      `
      SELECT COUNT(mco.character_id) AS count
      FROM matrix_character_order mco
      INNER JOIN characters AS c ON c.character_id = mco.character_id
      WHERE c.type = 0 AND mco.matrix_id = ? AND mco.character_id IN (?)`,
      { replacements: [this.matrix.matrix_id, characterIds] }
    )
    if (count != characterIds.length) {
      throw new UserError('Continuous characters cannot be have states')
    }
  }

  async checkCharactersAreNumeric(characterIds) {
    const [[{ count }]] = await sequelizeConn.query(
      `
      SELECT count(mco.character_id) AS count
      FROM matrix_character_order mco
      INNER JOIN characters AS c ON c.character_id = mco.character_id
      WHERE mco.matrix_id = ? AND mco.character_id IN (?) AND c.type != 0`,
      { replacements: [this.matrix.matrix_id, characterIds] }
    )
    if (count != characterIds.length) {
      throw new UserError('You must specific continuous or meristic characters')
    }
  }

  async getMediaByIds(mediaIds) {
    const [rows] = await sequelizeConn.query(
      `
      SELECT media_id, media
      FROM media_files
      WHERE project_id = ? AND media_id IN (?)`,
      { replacements: [this.project.project_id, mediaIds] }
    )
    const media = new Map()
    for (const row of rows) {
      const mediaId = parseInt(row.media_id)
      media.set(mediaId, row.media)
    }
    return media
  }
}

const FULL_USER_CAPABILITIES = [
  'addCharacter',
  'editCharacter',
  'deleteCharacter',
  'addCharacterComment',
  'addCharacterState',
  'editCharacterState',
  'deleteCharacterState',
  'addCharacterMedia',
  'deleteCharacterMedia',
  'reorderCharacters',
  'addCharacterCitation',
  'deleteCharacterCitation',
  'addTaxon',
  'addTaxonMedia',
  'deleteTaxonMedia',
  'editCellData',
  'editTaxon',
  'addCellComment',
  'editPartition',
  'setMatrixOptions',
]

const OBSERVER_CAPABILITES = ['addCharacterComment', 'addCellComment']

const CHARACTER_ANNOTATOR_CAPABILITIES = [
  'addCellComment',
  'addCharacterMedia',
  'deleteCharacterMedia',
  'addCharacterComment',
  'addCharacterCitation',
  'deleteCharacterCitation',
  'editCellData',
  'editTaxon',
  'addTaxonMedia',
  'deleteTaxonMedia',
  'editPartition',
]
