import { models } from '../../models/init-models.js'
import sequelizeConn from '../../util/db.js'
import { getTaxonName } from '../../util/taxa.js'
import config from '../../config.js'

/**
 * SDD (Structured Descriptive Data) Exporter for MorphoBank projects
 * Based on the original PHP ProjectSDDExporter
 */
export class SDDExporter {
  constructor(projectId, partitionId = null) {
    this.projectId = projectId
    this.partitionId = partitionId
    this.project = null
    this.partition = null
    this.taxa = null
    this.specimens = null
    this.characters = null
    this.media = null
    this.mediaViews = null
  }

  /**
   * Export project as SDD XML
   */
  async export() {
    // Load project
    this.project = await models.Project.findByPk(this.projectId)
    if (!this.project) {
      throw new Error(`Project ${this.projectId} not found`)
    }

    // Load partition if specified
    if (this.partitionId) {
      this.partition = await models.Partition.findByPk(this.partitionId)
    }

    // Generate XML
    const xml = await this.generateXML()
    return xml
  }

  /**
   * Generate the complete SDD XML document
   */
  async generateXML() {
    const currentDate = new Date().toISOString()

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Datasets xsi:schemaLocation="http://ns.tdwg.org/UBIF/2006/ http://www.lucidcentral.org/2006/SDD/SDD1.1-RC1/SDD.xsd"
          xmlns="http://ns.tdwg.org/UBIF/2006"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <TechnicalMetadata created="${currentDate}">
    <Generator name="${config.app.name || 'MorphoBank'}"/>
    <TechnicalContact label="support" name="MorphoBank Support" email="info@morphobank.org"/>
  </TechnicalMetadata>
  <Dataset xml:lang="en-us" id="P${this.projectId}">
    <Representation>
      <Label xml:lang="en">${this.escapeXML(this.project.name)}</Label>
      <Detail xml:lang="en" role="description">${this.escapeXML(
        this.project.description || ''
      )}</Detail>
      <Detail xml:lang="en" role="created_on">${new Date(
        this.project.created_on
      ).toISOString()}</Detail>`

    if (this.project.last_accessed_on) {
      xml += `
      <Detail xml:lang="en" role="last_accessed_on">${new Date(
        this.project.last_accessed_on
      ).toISOString()}</Detail>`
    }

    if (this.partition) {
      xml += `
      <Detail xml:lang="en" role="partition">${this.escapeXML(
        this.partition.name
      )} [${this.partitionId}]</Detail>`
      if (this.partition.description) {
        xml += `
      <Detail xml:lang="en" role="partitionDescription">${this.escapeXML(
        this.partition.description
      )}</Detail>`
      }
    }

    xml += `
      <Detail xml:lang="en" role="published">${
        this.project.published ? 'YES' : 'NO'
      }</Detail>`

    // Add journal information
    const journalFields = [
      'journal_title',
      'journal_url',
      'journal_number',
      'journal_year',
      'article_authors',
      'article_title',
      'article_pp',
    ]
    for (const field of journalFields) {
      const value = this.project[field]
      if (value && value.trim()) {
        xml += `
      <Detail xml:lang="en" role="${field}">${this.escapeXML(
          value.trim()
        )}</Detail>`
      }
    }

    xml += `
    </Representation>`

    // Add project-level components
    xml += await this.getMediaViewList()
    xml += await this.getCharacterList()
    xml += await this.getTaxonList()
    xml += await this.getMediaList()
    xml += await this.getSpecimenList()

    xml += `
</Dataset>`

    // Add matrix datasets
    const matrices = await this.getMatrices()
    for (const matrix of matrices) {
      xml += await this.generateMatrixDataset(matrix)
    }

    xml += `
</Datasets>`

    return xml
  }

  /**
   * Generate dataset for a specific matrix
   */
  async generateMatrixDataset(matrix) {
    const matrixId = matrix.matrix_id
    let xml = `
  <Dataset xml:lang="en-us" id="X${matrixId}${
      this.partitionId ? ':' + this.partitionId : ''
    }">
    <Representation>
      <Label xml:lang="en">${this.escapeXML(matrix.title || '')}</Label>
      <Detail xml:lang="en" role="extended_title">${this.escapeXML(
        matrix.title_extended || ''
      )}</Detail>`

    if (matrix.notes) {
      xml += `
      <Detail xml:lang="en" role="notes">${this.escapeXML(
        matrix.notes
      )}</Detail>`
    }

    if (this.partition) {
      xml += `
      <Detail xml:lang="en" role="partition">${this.escapeXML(
        this.partition.name
      )} [${this.partitionId}]</Detail>`
      if (this.partition.description) {
        xml += `
      <Detail xml:lang="en" role="partitionDescription">${this.escapeXML(
        this.partition.description
      )}</Detail>`
      }
    }

    xml += `
      <Detail xml:lang="en" role="created_on">${new Date(
        matrix.created_on
      ).toISOString()}</Detail>`

    if (matrix.last_accessed_on) {
      xml += `
      <Detail xml:lang="en" role="last_accessed_on">${new Date(
        matrix.last_accessed_on
      ).toISOString()}</Detail>`
    }

    xml += `
    </Representation>`

    // Add matrix-specific components
    xml += await this.getMediaViewList()
    xml += await this.getCharacterList(matrix)
    xml += await this.getTaxonList(matrix)
    xml += await this.getSpecimenList(matrix)
    xml += await this.getMediaList(matrix)
    xml += await this.getMatrixData(matrix)

    xml += `
  </Dataset>`

    return xml
  }

  /**
   * Get matrices for the project/partition
   */
  async getMatrices() {
    let whereClause = { project_id: this.projectId }

    if (this.project.published) {
      whereClause.published = 0
    }

    if (this.partitionId) {
      // Get matrices associated with partition
      const [results] = await sequelizeConn.query(
        `
        SELECT DISTINCT m.*
        FROM matrices m
        INNER JOIN characters_x_partitions cxp ON cxp.partition_id = ?
        INNER JOIN matrix_character_order mco ON mco.character_id = cxp.character_id AND mco.matrix_id = m.matrix_id
        WHERE m.project_id = ? AND m.published = 0
      `,
        {
          replacements: [this.partitionId, this.projectId],
        }
      )
      return results
    } else {
      return await models.Matrix.findAll({ where: whereClause })
    }
  }

  /**
   * Generate TaxonNames section
   */
  async getTaxonList(matrix = null) {
    const taxa = await this.getTaxa(matrix)

    if (!taxa || taxa.length === 0) {
      return ''
    }

    let xml = `
    <TaxonNames>`

    for (const taxon of taxa) {
      const displayName = getTaxonName(taxon, null, false, false)
      xml += `
      <TaxonName id="t${taxon.taxon_id}">
        <Label><Text>${this.escapeXML(displayName)}</Text></Label>`

      if (taxon.scientific_name_author) {
        xml += `
        <CanonicalAuthorship>${this.escapeXML(
          taxon.scientific_name_author
        )}</CanonicalAuthorship>`
      }

      xml += `
      </TaxonName>`
    }

    xml += `
    </TaxonNames>`
    return xml
  }

  /**
   * Generate Specimens section
   */
  async getSpecimenList(matrix = null) {
    const specimens = await this.getSpecimens(matrix)

    if (!specimens || specimens.length === 0) {
      return ''
    }

    let xml = `
    <Specimens>`

    for (const specimen of specimens) {
      xml += `
      <Specimen id="s${specimen.specimen_id}">
        <Representation>
          <Label>${this.escapeXML(specimen.name || '')}</Label>`

      if (specimen.description) {
        xml += `
          <Detail xml:lang="en" role="description">${this.escapeXML(
            specimen.description
          )}</Detail>`
      }

      // Add media references
      if (specimen.media_ids && specimen.media_ids.length > 0) {
        for (const mediaId of specimen.media_ids) {
          xml += `
          <MediaObject ref="m${mediaId}"/>`
        }
      }

      xml += `
        </Representation>`

      // Add taxon references
      if (specimen.taxa_ids && specimen.taxa_ids.length > 0) {
        for (const taxonId of specimen.taxa_ids) {
          xml += `
        <TaxonName ref="t${taxonId}"/>`
        }
      }

      xml += `
      </Specimen>`
    }

    xml += `
    </Specimens>`
    return xml
  }

  /**
   * Generate Characters section
   */
  async getCharacterList(matrix = null) {
    const characters = await this.getCharacters(matrix)

    if (!characters || characters.length === 0) {
      return ''
    }

    let xml = `
    <Characters>`

    for (const character of characters) {
      xml += `
      <CategoricalCharacter id="c${character.character_id}">
        <Representation><Label>${this.escapeXML(
          character.name || ''
        )}</Label></Representation>`

      // Add character states
      if (character.states && character.states.length > 0) {
        xml += `
        <States>`

        for (const state of character.states) {
          xml += `
          <StateDefinition id="cs${state.state_id}">
            <Representation>
              <Label>${this.escapeXML(state.name || '')}</Label>
              <Detail xml:lang="en" role="number">${state.num || 0}</Detail>`

          // Add state media
          if (state.media_ids && state.media_ids.length > 0) {
            for (const mediaId of state.media_ids) {
              xml += `
              <MediaObject ref="m${mediaId}"/>`
            }
          }

          xml += `
            </Representation>
          </StateDefinition>`
        }

        xml += `
        </States>`
      }

      // Add character media
      if (character.media_ids && character.media_ids.length > 0) {
        for (const mediaId of character.media_ids) {
          xml += `
        <MediaObject ref="m${mediaId}"/>`
        }
      }

      xml += `
      </CategoricalCharacter>`
    }

    xml += `
    </Characters>`
    return xml
  }

  /**
   * Generate MediaObjects section
   */
  async getMediaList(matrix = null) {
    const media = await this.getMedia(matrix)

    if (!media || media.length === 0) {
      return ''
    }

    let xml = `
    <MediaObjects>`

    for (const mediaItem of media) {
      xml += `
      <MediaObject id="m${mediaItem.media_id}">
        <Representation>
          <Label>${this.escapeXML(mediaItem.specimen_name || '')}</Label>`

      if (mediaItem.notes) {
        xml += `
          <Detail xml:lang="en" role="notes">${this.escapeXML(
            mediaItem.notes
          )}</Detail>`
      }

      if (mediaItem.view_id) {
        xml += `
          <DescriptiveConcept ref="v${mediaItem.view_id}"/>`
      }

      xml += `
        </Representation>
        <Type>${this.escapeXML(
          mediaItem.mimetype || 'application/octet-stream'
        )}</Type>`

      // Add file reference
      if (mediaItem.filename) {
        xml += `
        <Data href="file:/media/M${mediaItem.media_id}_${mediaItem.filename}"/>`
      }

      xml += `
      </MediaObject>`
    }

    xml += `
    </MediaObjects>`
    return xml
  }

  /**
   * Generate DescriptiveConcepts (Media Views) section
   */
  async getMediaViewList() {
    const views = await this.getMediaViews()

    if (!views || views.length === 0) {
      return ''
    }

    let xml = `
    <DescriptiveConcepts>`

    for (const view of views) {
      xml += `
      <DescriptiveConcept id="v${
        view.view_id
      }"><Representation><Label>${this.escapeXML(
        view.name || ''
      )}</Label></Representation></DescriptiveConcept>`
    }

    xml += `
    </DescriptiveConcepts>`
    return xml
  }

  /**
   * Generate CodedDescriptions (Matrix data) section
   */
  async getMatrixData(matrix) {
    const matrixId = matrix.matrix_id

    // Get cell data
    const [cells] = await sequelizeConn.query(
      `
      SELECT DISTINCT
        c.taxon_id, c.character_id, c.state_id, c.is_npa
      FROM cells AS c
      INNER JOIN characters AS ch ON ch.character_id = c.character_id
      WHERE c.matrix_id = ? AND ch.type = 0
    `,
      {
        replacements: [matrixId],
      }
    )

    // Get cell notes
    const [cellNotes] = await sequelizeConn.query(
      `
      SELECT taxon_id, character_id, notes
      FROM cell_notes
      WHERE matrix_id = ?
    `,
      {
        replacements: [matrixId],
      }
    )

    // Get cell media
    const [cellMedia] = await sequelizeConn.query(
      `
      SELECT cxm.taxon_id, cxm.character_id, mf.media_id
      FROM cells_x_media cxm
      INNER JOIN media_files AS mf ON mf.media_id = cxm.media_id
      WHERE cxm.matrix_id = ?
    `,
      {
        replacements: [matrixId],
      }
    )

    // Organize data
    const cellData = {}
    const cellNotesMap = {}
    const cellMediaMap = {}

    cells.forEach((cell) => {
      const key = `${cell.taxon_id}_${cell.character_id}`
      if (!cellData[key]) cellData[key] = []

      if (cell.is_npa > 0) {
        cellData[key].push('NPA')
      } else if (!cell.state_id) {
        cellData[key].push('-')
      } else {
        cellData[key].push(`s${cell.state_id}`)
      }
    })

    cellNotes.forEach((note) => {
      const key = `${note.taxon_id}_${note.character_id}`
      cellNotesMap[key] = note.notes
    })

    cellMedia.forEach((media) => {
      const key = `${media.taxon_id}_${media.character_id}`
      cellMediaMap[key] = media.media_id
    })

    // Get taxa and characters for this matrix
    const taxa = await this.getTaxa(matrix)
    const characters = await this.getMatrixCharacterIds(matrixId)

    let xml = `
    <CodedDescriptions>`

    for (const taxon of taxa) {
      const displayName = getTaxonName(taxon, null, false, false)
      xml += `
      <CodedDescription id="row_t${taxon.taxon_id}">
        <Representation><Label>${this.escapeXML(
          displayName
        )}</Label></Representation>
        <Scope><TaxonName ref="t${taxon.taxon_id}"></TaxonName></Scope>
        <SummaryData>`

      for (const characterId of characters) {
        xml += `
          <Categorical ref="c${characterId}">`

        const key = `${taxon.taxon_id}_${characterId}`

        // Add notes
        if (cellNotesMap[key]) {
          xml += `
            <Representation><Detail xml:lang="en" role="note">${this.escapeXML(
              cellNotesMap[key]
            )}</Detail></Representation>`
        }

        // Add media
        if (cellMediaMap[key]) {
          xml += `
            <MediaObject ref="m${cellMediaMap[key]}" />`
        }

        // Add states
        if (cellData[key] && cellData[key].length > 0) {
          for (const state of cellData[key]) {
            xml += `
            <State ref="${state}"/>`
          }
        } else {
          xml += `
            <State ref="?"/>`
        }

        xml += `
          </Categorical>`
      }

      xml += `
        </SummaryData>
      </CodedDescription>`
    }

    xml += `
    </CodedDescriptions>`
    return xml
  }

  /**
   * Get taxa for project/matrix
   */
  async getTaxa(matrix = null) {
    if (matrix) {
      const [results] = await sequelizeConn.query(
        `
        SELECT t.*
        FROM taxa t
        INNER JOIN matrix_taxa_order mto ON mto.taxon_id = t.taxon_id
        WHERE mto.matrix_id = ?
        ORDER BY mto.position
      `,
        {
          replacements: [matrix.matrix_id],
        }
      )
      return results
    } else if (this.partitionId) {
      const [results] = await sequelizeConn.query(
        `
        SELECT DISTINCT t.*
        FROM taxa t
        INNER JOIN taxa_x_partitions txp ON txp.taxon_id = t.taxon_id
        WHERE txp.partition_id = ? AND t.project_id = ?
        ORDER BY t.genus, t.specific_epithet
      `,
        {
          replacements: [this.partitionId, this.projectId],
        }
      )
      return results
    } else {
      return await models.Taxon.findAll({
        where: { project_id: this.projectId },
        order: [
          ['genus', 'ASC'],
          ['specific_epithet', 'ASC'],
        ],
      })
    }
  }

  /**
   * Get specimens for project/matrix
   */
  async getSpecimens(matrix = null) {
    let query, replacements

    if (matrix) {
      query = `
        SELECT DISTINCT s.*, mf.media_id
        FROM specimens s
        INNER JOIN media_files AS mf ON mf.specimen_id = s.specimen_id AND mf.project_id = s.project_id
        INNER JOIN cells_x_media AS cxm ON cxm.media_id = mf.media_id
        WHERE s.project_id = ? AND cxm.matrix_id = ?
        ORDER BY s.specimen_id, mf.media_id
      `
      replacements = [this.projectId, matrix.matrix_id]
    } else {
      query = `
        SELECT s.*, mf.media_id
        FROM specimens s
        LEFT JOIN media_files AS mf ON mf.specimen_id = s.specimen_id AND mf.project_id = s.project_id
        WHERE s.project_id = ?
        ORDER BY s.specimen_id, mf.media_id
      `
      replacements = [this.projectId]
    }

    const [results] = await sequelizeConn.query(query, { replacements })

    // Group by specimen and collect media IDs
    const specimens = {}
    for (const row of results) {
      const specimenId = row.specimen_id
      if (!specimens[specimenId]) {
        specimens[specimenId] = {
          ...row,
          media_ids: [],
          taxa_ids: [],
        }
      }
      if (row.media_id) {
        specimens[specimenId].media_ids.push(row.media_id)
      }
    }

    // Get taxa associations
    if (Object.keys(specimens).length > 0) {
      const specimenIds = Object.keys(specimens)
      const [taxaResults] = await sequelizeConn.query(`
        SELECT specimen_id, taxon_id 
        FROM taxa_x_specimens 
        WHERE specimen_id IN (${specimenIds.join(',')})
      `)

      for (const row of taxaResults) {
        if (specimens[row.specimen_id]) {
          specimens[row.specimen_id].taxa_ids.push(row.taxon_id)
        }
      }
    }

    return Object.values(specimens)
  }

  /**
   * Get characters for project/matrix
   */
  async getCharacters(matrix = null) {
    let characters

    if (matrix) {
      const [results] = await sequelizeConn.query(
        `
        SELECT c.*
        FROM characters c
        INNER JOIN matrix_character_order mco ON mco.character_id = c.character_id
        WHERE mco.matrix_id = ?
        ORDER BY mco.position
      `,
        {
          replacements: [matrix.matrix_id],
        }
      )
      characters = results
    } else if (this.partitionId) {
      const [results] = await sequelizeConn.query(
        `
        SELECT DISTINCT c.*
        FROM characters c
        INNER JOIN characters_x_partitions cxp ON cxp.character_id = c.character_id
        WHERE cxp.partition_id = ? AND c.project_id = ?
        ORDER BY c.name
      `,
        {
          replacements: [this.partitionId, this.projectId],
        }
      )
      characters = results
    } else {
      characters = await models.Character.findAll({
        where: { project_id: this.projectId },
        order: [['name', 'ASC']],
      })
    }

    // Get states and media for each character
    if (characters.length > 0) {
      const characterIds = characters.map((c) => c.character_id)

      // Get states
      const [states] = await sequelizeConn.query(`
        SELECT character_id, state_id, name, num
        FROM character_states
        WHERE character_id IN (${characterIds.join(',')})
        ORDER BY character_id, num
      `)

      // Get character media
      const [characterMedia] = await sequelizeConn.query(`
        SELECT cxm.character_id, cxm.media_id, cxm.state_id
        FROM characters_x_media cxm
        INNER JOIN media_files AS mf ON mf.media_id = cxm.media_id
        WHERE cxm.character_id IN (${characterIds.join(',')})
      `)

      // Organize data
      const statesMap = {}
      const mediaMap = {}

      states.forEach((state) => {
        if (!statesMap[state.character_id]) statesMap[state.character_id] = []
        statesMap[state.character_id].push({
          ...state,
          media_ids: [],
        })
      })

      characterMedia.forEach((media) => {
        if (media.state_id) {
          // State-specific media
          const states = statesMap[media.character_id] || []
          const state = states.find((s) => s.state_id === media.state_id)
          if (state) {
            state.media_ids.push(media.media_id)
          }
        } else {
          // Character-level media
          if (!mediaMap[media.character_id]) mediaMap[media.character_id] = []
          mediaMap[media.character_id].push(media.media_id)
        }
      })

      // Add states and media to characters
      characters.forEach((character) => {
        character.states = statesMap[character.character_id] || []
        character.media_ids = mediaMap[character.character_id] || []
      })
    }

    return characters
  }

  /**
   * Get media for project/matrix
   */
  async getMedia(matrix = null) {
    let query, replacements

    if (matrix) {
      query = `
        SELECT DISTINCT mf.media_id, s.specimen_id, mf.media, mf.notes, mv.name as view_name, mv.view_id
        FROM media_files mf
        LEFT JOIN specimens AS s ON mf.specimen_id = s.specimen_id
        LEFT JOIN media_views AS mv ON mf.view_id = mv.view_id
        INNER JOIN cells_x_media AS cxm ON cxm.media_id = mf.media_id
        WHERE mf.project_id = ? AND cxm.matrix_id = ?
      `
      replacements = [this.projectId, matrix.matrix_id]
    } else {
      query = `
        SELECT mf.media_id, s.specimen_id, mf.media, mf.notes, mv.name as view_name, mv.view_id
        FROM media_files mf
        LEFT JOIN specimens AS s ON mf.specimen_id = s.specimen_id
        LEFT JOIN media_views AS mv ON mf.view_id = mv.view_id
        WHERE mf.project_id = ?
      `
      replacements = [this.projectId]
    }

    const [results] = await sequelizeConn.query(query, { replacements })

    // Add specimen names and media info
    for (const media of results) {
      if (media.specimen_id) {
        const specimen = await models.Specimen.findByPk(media.specimen_id)
        media.specimen_name = specimen ? specimen.name : ''
      }

      // Extract filename and mimetype from media JSON if available
      if (media.media) {
        try {
          const mediaInfo = JSON.parse(media.media)
          media.filename = mediaInfo.ORIGINAL_FILENAME || `M${media.media_id}`
          media.mimetype = mediaInfo.MIMETYPE || 'application/octet-stream'
        } catch (e) {
          media.filename = `M${media.media_id}`
          media.mimetype = 'application/octet-stream'
        }
      }
    }

    return results
  }

  /**
   * Get media views for project
   */
  async getMediaViews() {
    let query, replacements

    if (this.partitionId) {
      query = `
        SELECT DISTINCT mv.view_id, mv.name
        FROM media_views AS mv
        WHERE mv.project_id = ? AND mv.view_id IN (
          SELECT mf.view_id
          FROM media_files AS mf
          INNER JOIN cells_x_media AS cxm ON cxm.media_id = mf.media_id
          INNER JOIN taxa_x_partitions AS txp ON txp.taxon_id = cxm.taxon_id
          INNER JOIN characters_x_partitions AS cxp ON cxp.character_id = cxm.character_id
          WHERE cxp.partition_id = ? AND txp.partition_id = ?
        )
      `
      replacements = [this.projectId, this.partitionId, this.partitionId]
    } else {
      query = `SELECT view_id, name FROM media_views WHERE project_id = ?`
      replacements = [this.projectId]
    }

    const [results] = await sequelizeConn.query(query, { replacements })
    return results
  }

  /**
   * Get character IDs for a matrix
   */
  async getMatrixCharacterIds(matrixId) {
    const [results] = await sequelizeConn.query(
      `
      SELECT mco.character_id
      FROM matrix_character_order mco
      INNER JOIN characters AS c ON mco.character_id = c.character_id
      WHERE mco.matrix_id = ? AND c.type = 0
      ORDER BY mco.position
    `,
      {
        replacements: [matrixId],
      }
    )

    return results.map((r) => r.character_id)
  }

  /**
   * Escape XML special characters
   */
  escapeXML(str) {
    if (!str) return ''
    return str
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
}
