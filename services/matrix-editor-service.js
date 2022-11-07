import _sequelize from 'sequelize'
import sequelizeConn from '../util/db.js'
import { models } from '../models/init-models.js'
import { getRoles } from '../services/user-roles-service.js'
import { MATRIX_OPTIONS } from '../util/matrix.js'
import { getMedia } from '../util/media.js'
import { getTaxonName, TAXA_FIELD_NAMES } from '../util/taxa.js'

class MatrixEditorService {
  constructor(project, matrix, user, readonly) {
    this.project = project
    this.matrix = matrix
    this.user = user
    this.readonly = readonly
  }

  static async create(projectId, matrixId, userId, readonly) {
    const project = await models.Project.findByPk(projectId)
    const matrix = await models.Matrix.findByPk(matrixId)
    const user = await models.User.findByPk(userId)
    return new MatrixEditorService(project, matrix, user, readonly)
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
      sync_point: await this.getNewSyncPoint(),
    }
  }

  async getCellData() {
    const [rows] = await sequelizeConn.query(
      `
			SELECT
        c.cell_id, c.taxon_id, c.character_id, c.state_id, c.user_id, c.is_npa, c.is_uncertain,
        c.created_on, c.start_value, c.end_value, ch.type
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
      cells: this.convertCellQueryToResults(rows),
    }
  }

  // TODO(alvaro): Implement this.
  async getCellCounts() {
    return {
      counts: {
        updates: {},
        citation_counts: {},
        comment_counts: {},
        unread_comment_counts: {},
      },
    }
  }

  // TODO(alvaro): Implement this.
  getAllCellNotes() {
    return { notes: [] }
  }

  // TODO(alvaro): Implement this.
  getCellMedia() {
    return { media: [] }
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

  async getPartitions() {
    const [characterRows] = await sequelizeConn.query(
      `
			SELECT cxp.partition_id, cxp.character_id
			FROM characters_x_partitions cxp
			INNER JOIN matrix_character_order AS mco ON mco.character_id = cxp.character_id
			INNER JOIN matrices AS m ON mco.matrix_id = m.matrix_id
			INNER JOIN partitions AS p ON m.project_id = p.project_id AND cxp.partition_id = p.partition_id
			WHERE m.matrix_id = ?`,
      { replacements: [this.matrix.matrix_id] }
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
			INNER JOIN matrix_taxa_order AS mto ON mto.taxon_id = txp.taxon_id
			INNER JOIN matrices AS m ON mto.matrix_id = m.matrix_id
			INNER JOIN partitions AS p ON m.project_id = p.project_id AND txp.partition_id = p.partition_id
			WHERE m.matrix_id = ? `,
      { replacements: [this.matrix.matrix_id] }
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
			WHERE m.matrix_id = ?
      ORDER BY p.name`,
      { replacements: [this.matrix.matrix_id] }
    )

    const partitions = []
    for (const row of partitionRows) {
      const partitionId = parseInt(row.partition_id)
      partitions.push({
        id: partitionId,
        name: row.name,
        description: row.description,
        project_id: parseInt(row.project_id),
        character_ids: characters.get(partitionId) ?? {},
        taxa_ids: taxa.get(partitionId) ?? {},
      })
    }
    return partitions
  }

  async shouldLimitToPublishedData() {
    const roles = await this.getRoles()
    const isAnonymousReviewer = roles.includes('anonymous_reviewer')
    return this.project.status == 1 || isAnonymousReviewer || this.readonly
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
    if (!(await this.canDo('addTaxon'))) {
      throw 'You are not allowed to add taxa'
    }

    // Ensure that all of the taxa belongs to this project. This ensures that the user is not
    // passing in invalid taxa.
    const [[{ count }]] = await sequelizeConn.query(
      `
      SELECT COUNT(*) AS count
      FROM taxa WHERE project_id = ? AND taxon_id IN (?)`,
      { replacements: [this.project.project_id, taxaIds] }
    )
    if (count != taxaIds.length) {
      throw 'Taxa is not in this project'
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
        throw 'Insertion position is not valid'
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
      throw 'You must be an administrator to remove a taxon from this matrix'
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
      throw 'No taxa were specified'
    }

    if (!(await this.canDo('editCellData'))) {
      throw 'You are not allowed to reorder this matrix'
    }

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
      throw 'You must specify taxa to modify the notes'
    }

    if (!(await this.canDo('editTaxon'))) {
      throw 'You are not allowed to modify taxa in this matrix'
    }

    if (!(await this.canEditTaxa(taxaIds))) {
      throw 'You are not allowed to modify one or more of the selected taxa'
    }

    const transaction = await sequelizeConn.transaction()

    const Op = _sequelize.Op
    await models.Taxon.update(
      { notes: notes },
      {
        where: { taxon_id: { [Op.in]: taxaIds } },
        transaction: transaction,
      }
    )

    await transaction.commit()
    return {
      taxa_ids: taxaIds,
      notes: notes,
    }
  }

  async setTaxaAccess(taxaIds, userId, groupId) {
    if (!(await this.canDo('editTaxon'))) {
      throw 'You are not allowed to modify taxa in this matrix'
    }

    if (!(await this.isAdminLike())) {
      throw 'You are not allowed to modify one or more of the selected taxa'
    }

    const transaction = await sequelizeConn.transaction()

    const Op = _sequelize.Op
    await models.MatrixTaxaOrder.update(
      {
        user_id: notes,
        group_id: groupId,
      },
      {
        where: {
          taxon_id: { [Op.in]: taxaIds },
          matrix_id: this.matrix.matrix_id,
        },
        transaction: transaction,
      }
    )

    await transaction.commit()
    return {
      taxa_ids: taxaIds,
      user_id: userId,
      group_id: groupId,
    }
  }

  async addTaxonMedia(taxaIds, mediaIds) {
    if (!await this.canDo('addTaxonMedia')) {
      throw 'You are not allowed to add media to this taxon'
    }

    if (!await this.canEditTaxa(taxaIds)) {
      throw 'You are not allowed to modify one or more of the selected taxa'
    }

    const media = await this.getMediaByIds(mediaIds)
    if (media.size != mediaIds.length) {
      throw 'One or more of the media do not belong to the project'
    }

    const transaction = await sequelizeConn.transaction()
    const mediaList = []
    const time = parseInt(Date.now() / 1000)
    for (const mediaId of mediaIds) {
      const tinyMedia = getMedia(media.get(mediaId), 'tiny')
      for (const taxonId of taxaIds) {
        const [taxonMedia, isCreated] = await models.TaxaXMedium.findOrCreate(
          {
            where: { 
              taxon_id: taxonId,
              media_id: mediaId,
            },
            defaults: {
              taxon_id: taxonId,
              media_id: mediaId,
              user_id: this.user.user_id,
              created_on: time,
            },
            transaction: transaction
          }
        )
        if (!isCreated) {
          continue
        }

        mediaList.push({
          'link_id': taxonMedia.link_id,
          'media_id': taxonMedia.media_id,
          'taxon_id': taxonMedia.taxon_id,
          'tiny': tinyMedia,      
        })
      }
    }

    await transaction.commit()
    return {
      'media': mediaList
    }
  }

  async loadTaxaMedia(taxonId, search) {
    const media = []
    const mediaIds = []
  
    if (search) {
      //TODO(kenzley): Implement search functionality using Elastic Search.
    } else {
      const replacements = [this.project.project_id]
      let clause = ''
      const taxon = await models.Taxon.findByPk(taxonId)
      if (taxon != null) {
        // Instead of searching by a single taxon, we are searching for media belonging to similar taxa which match
        // the genus, species, and subspecies if available. If none are available, let's instead return all media
        // associated with the project.
        const fields = ['subspecific_epithet', 'specific_epithet', 'genus']
        for (const field of fields) {
          const unit = taxon[field]
          if (unit) {
            clause += ` AND t.${field} = ?`
            replacements.push(unit)
          }
        }
      }

      const [rows] = await sequelizeConn.query(`
          SELECT
            DISTINCT mf.media_id, mf.media
          FROM media_files mf
          INNER JOIN specimens AS s ON s.specimen_id = mf.specimen_id
          INNER JOIN taxa_x_specimens AS txs ON s.specimen_id = txs.specimen_id
          INNER JOIN taxa AS t ON txs.taxon_id = t.taxon_id
          WHERE
            mf.project_id = ? AND mf.cataloguing_status = 0 ${clause}
          ORDER BY mf.media_id`,
        { replacements: replacements })
      for (const row of rows) {
        const mediaId = parseInt(row.media_id)
        mediaIds.push(mediaId)
        media.push({
          'media_id': mediaId,
          'icon': getMedia(row.media, 'icon'),
          'tiny': getMedia(row.media, 'tiny'),
        })
      }
    }

    // Sort by the last the time user recently used the media. This ensures that recently used media
    // is at the top of the media grid.
    if (mediaIds.length) {
      const [rows] = await sequelizeConn.query(`
      SELECT media_id, MAX(created_on) AS created_on
      FROM cells_x_media
      WHERE matrix_id = ? AND user_id = ? AND media_id IN(?)
      GROUP BY media_id`,
      { replacements: [this.matrix.matrix_id, this.user.user_id, mediaIds] })

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
      'media': media
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
      user_groups: this.getUserMemberGroups(),
      is_admin: await this.isAdminLike(),
      user_id: parseInt(this.user.user_id),
      last_login: 0, // TODO(alvaro): Implement this.
      allowable_actions: await this.getUserAllowableActions(),
      allowable_publish: this.getPublishAllowableActions(),
      preferences: {
        ...this.getPreferences(),
        ...(await this.getPublicAccessInfo()),
      },
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

  // TODO(alvaro): Implement this.
  getNewSyncPoint() {
    return ''
  }

  // TODO(alvaro): Implement this.
  getPreferences() {
    return []
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
    const times = new Map()

    const time = Date.now()
    const [characterRows] = await sequelizeConn.query(
      `
        SELECT character_id 
        FROM matrix_character_order AS mco
        WHERE matrix_id = ?`,
      { replacements: [this.matrix.matrix_id] }
    )
    for (const row of characterRows) {
      const characterId = parseInt(row.character_id)
      times.set(characterId, time)
    }

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
    const [rows] = await sequelizeConn.query(`
      SELECT pmg.group_id
      FROM projects_x_users AS pu
			INNER JOIN project_members_x_groups AS pmg ON pmg.membership_id = pu.link_id
			WHERE pu.project_id = ? AND pu.user_id = ?`,
      { replacements: [this.project.project_id, this.user.user_id] })
    return rows.map(row => parseInt(row.group_id))
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

  convertCellQueryToResults(rows) {
    const cells = []
    for (const row of rows) {
      const taxonId = parseInt(row.taxon_id)
      const characterId = parseInt(row.character_id)
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
      // This is a shortcut to evaluate discrete characters to false and continuous and mestric
      // characters to true since they are numeric.
      const isNumeric = !!row.type
      if (isNumeric) {
        const convertFunction = parseInt(row.type) == 1 ? parseFloat : parseInt
        if (row.start_value) {
          cell['sv'] = convertFunction(row.start_value)
        }
        if (row.end_value) {
          cell['ev'] = convertFunction(row.end_value)
        }
      }
      cells.push(cell)
    }
    return cells
  }

  async canDo(action) {
    const actions = await this.getUserAllowableActions()
    return actions.includes(action)
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
      INSERT INTO ca_change_log(log_datetime, user_id, unit_id, changetype, rolledback, logged_table_num, logged_row_id)
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

  async canEditTaxa(taxaIds) {
    const [[{ count }]] = await sequelizeConn.query(
      `
			SELECT COUNT(mto.taxon_id) AS count
			FROM matrix_taxa_order mto
			INNER JOIN matrices AS m ON mto.matrix_id = m.matrix_id
			INNER JOIN projects_x_users AS pxu ON m.project_id = pxu.project_id
			LEFT JOIN project_members_x_groups AS pmxg ON pmxg.membership_id = pxu.link_id
			WHERE
				m.matrix_id = ? AND pxu.user_id = ? AND mto.taxon_id IN (?) AND
        (mto.group_id = pmxg.group_id OR mto.user_id IS NULL OR mto.user_id = 0 OR mto.user_id = ?)`,
      {
        replacements: [
          taxaIds,
          this.matrix.matrix_id,
          this.user.user_id,
          this.user.user_id,
        ],
      }
    )
    return count == taxaIds.length
  }

  async getMediaByIds(mediaIds) {
    const [rows] = await sequelizeConn.query(`
			SELECT media_id, media
			FROM media_files
			WHERE project_id = ? AND media_id IN (?)`,
      { replacements: [this.project.project_id, mediaIds] })
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
  'addCharacterToPartition',
  'addTaxonToPartition',
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
  'addCharacterToPartition',
  'addTaxonToPartition',
]

export default MatrixEditorService
