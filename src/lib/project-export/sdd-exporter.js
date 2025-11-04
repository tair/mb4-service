import { models } from '../../models/init-models.js'
import sequelizeConn from '../../util/db.js'
import { getTaxonName } from '../../util/taxa.js'
import config from '../../config.js'
import archiver from 'archiver'
import fs from 'fs'
import path from 'path'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@aws-sdk/node-http-handler'
import { Readable } from 'stream'
import { NexusExporter } from '../matrix-export/nexus-exporter.js'
import { ExportOptions } from '../matrix-export/exporter.js'
import * as matrixService from '../../services/matrix-service.js'

/**
 * SDD (Structured Descriptive Data) Exporter for MorphoBank projects
 * Based on the original PHP ProjectSDDExporter
 */
export class SDDExporter {
  constructor(projectId, partitionId = null, progressCallback = null) {
    this.projectId = projectId
    this.partitionId = partitionId
    this.project = null
    this.partition = null
    this.taxa = null
    this.specimens = null
    this.characters = null
    this.media = null
    this.mediaViews = null
    this.progressCallback = progressCallback
    this.totalSteps = 0
    this.currentStep = 0
  }

  /**
   * Report progress to callback if provided
   * @param {string} stage - Current stage name
   * @param {number} current - Current item number
   * @param {number} total - Total items in this stage
   * @param {string} message - Progress message
   */
  reportProgress(stage, current = 0, total = 0, message = '') {
    if (this.progressCallback) {
      const overallProgress =
        this.totalSteps > 0 ? (this.currentStep / this.totalSteps) * 100 : 0
      const stageProgress = total > 0 ? (current / total) * 100 : 0

      this.progressCallback({
        stage,
        overallProgress: Math.round(overallProgress),
        stageProgress: Math.round(stageProgress),
        current,
        total,
        message,
        projectId: this.projectId,
        partitionId: this.partitionId,
      })
    }
  }

  /**
   * Format file size in human readable format
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size (e.g., "2.5 MB", "150 KB")
   */
  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B'

    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    const size = bytes / Math.pow(1024, i)

    if (i === 0) return `${bytes} B`
    return `${size.toFixed(1)} ${sizes[i]}`
  }

  /**
   * Get file size from media JSON field
   * @param {Object} mediaItem - Media item with media JSON field
   * @returns {number} File size in bytes
   */
  getMediaFileSize(mediaItem) {
    if (!mediaItem.media) return 0

    try {
      const mediaData =
        typeof mediaItem.media === 'string'
          ? JSON.parse(mediaItem.media)
          : mediaItem.media

      // Try to get filesize from INPUT section first (original file)
      if (mediaData.INPUT && mediaData.INPUT.FILESIZE) {
        return mediaData.INPUT.FILESIZE
      }

      // Fallback to original section
      if (
        mediaData.original &&
        mediaData.original.PROPERTIES &&
        mediaData.original.PROPERTIES.filesize
      ) {
        return mediaData.original.PROPERTIES.filesize
      }

      // Last fallback - any version with filesize
      for (const version of ['large', 'medium', 'small', 'thumbnail']) {
        if (
          mediaData[version] &&
          mediaData[version].PROPERTIES &&
          mediaData[version].PROPERTIES.filesize
        ) {
          return mediaData[version].PROPERTIES.filesize
        }
      }

      return 0
    } catch (error) {
      console.warn(
        `Error parsing media JSON for media_id ${mediaItem.media_id}:`,
        error
      )
      return 0
    }
  }

  /**
   * Get file format from media JSON field
   * @param {Object} mediaItem - Media item with media JSON field and media_type
   * @returns {string} File extension (e.g., "TIFF", "JPG", "MP4")
   */
  getMediaFormat(mediaItem) {
    if (!mediaItem.media) {
      // Fallback to media_type from database
      return mediaItem.media_type
        ? mediaItem.media_type.toUpperCase()
        : 'UNKNOWN'
    }

    try {
      const mediaData =
        typeof mediaItem.media === 'string'
          ? JSON.parse(mediaItem.media)
          : mediaItem.media

      // Try to get format from original file first
      if (
        mediaData.original &&
        mediaData.original.PROPERTIES &&
        mediaData.original.PROPERTIES.typename
      ) {
        return mediaData.original.PROPERTIES.typename.toUpperCase()
      }

      // Try INPUT section
      if (mediaData.INPUT && mediaData.INPUT.MIMETYPE) {
        const mimeType = mediaData.INPUT.MIMETYPE
        if (mimeType.includes('tiff')) return 'TIFF'
        if (mimeType.includes('jpeg')) return 'JPG'
        if (mimeType.includes('png')) return 'PNG'
        if (mimeType.includes('gif')) return 'GIF'
        if (mimeType.includes('mp4')) return 'MP4'
        if (mimeType.includes('avi')) return 'AVI'
        if (mimeType.includes('mov')) return 'MOV'
      }

      // Fallback to original extension
      if (mediaData.original && mediaData.original.EXTENSION) {
        return mediaData.original.EXTENSION.toUpperCase()
      }

      // Last fallback to media_type from database
      return mediaItem.media_type
        ? mediaItem.media_type.toUpperCase()
        : 'UNKNOWN'
    } catch (error) {
      console.warn(
        `Error parsing media JSON for media_id ${mediaItem.media_id}:`,
        error
      )
      return mediaItem.media_type
        ? mediaItem.media_type.toUpperCase()
        : 'UNKNOWN'
    }
  }

  /**
   * Export project as SDD XML only
   */
  async export() {
    this.totalSteps = 2
    this.currentStep = 0

    this.reportProgress('initializing', 0, 1, 'Loading...')

    // Load project
    this.project = await models.Project.findByPk(this.projectId)
    if (!this.project) {
      throw new Error(`Project ${this.projectId} not found`)
    }

    // Load partition if specified
    if (this.partitionId) {
      this.partition = await models.Partition.findByPk(this.partitionId)
    }

    this.currentStep++
    this.reportProgress('generating', 0, 1, 'Generating XML...')

    // Generate XML
    const xml = await this.generateXML()

    this.currentStep++
    this.reportProgress('completed', 1, 1, 'Complete')

    return xml
  }

  /**
   * Export project as ZIP archive containing SDD XML and media files
   */
  async exportAsZip(outputStream) {
    console.log(
      `[SDD Export] Starting export for project ${this.projectId}${
        this.partitionId ? ` (partition ${this.partitionId})` : ''
      }`
    )
    this.totalSteps = 6
    this.currentStep = 0

    this.reportProgress('initializing', 0, 1, 'Loading...')
    console.log('[SDD Export] Loading project data...')

    // Load project
    const projectStartTime = Date.now()
    this.project = await models.Project.findByPk(this.projectId)
    if (!this.project) {
      throw new Error(`Project ${this.projectId} not found`)
    }
    console.log(
      `[SDD Export] Project loaded in ${(
        (Date.now() - projectStartTime) /
        1000
      ).toFixed(1)}s: ${this.project.name}`
    )

    // Load partition if specified
    if (this.partitionId) {
      this.partition = await models.Partition.findByPk(this.partitionId)
      console.log(
        `[SDD Export] Partition loaded: ${this.partition?.name || 'unknown'}`
      )
    }

    this.currentStep++
    this.reportProgress('creating_archive', 0, 1, 'Creating archive...')
    console.log('[SDD Export] Step 1: Creating ZIP archive...')

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    })

    // Handle archive errors
    archive.on('error', (err) => {
      console.error('[SDD Export] Archive error:', err.message)
      throw err
    })

    // Pipe archive to output stream
    archive.pipe(outputStream)
    console.log('[SDD Export] Archive piped to output stream')

    this.currentStep++
    this.reportProgress('generating_xml', 0, 1, 'Adding XML...')
    console.log('[SDD Export] Step 2: Generating XML...')

    // Step 1: Generate and add SDD XML
    const xmlStartTime = Date.now()
    const sddXml = await this.generateXML()
    const xmlDuration = Date.now() - xmlStartTime
    console.log(
      `[SDD Export] XML generated in ${(xmlDuration / 1000).toFixed(
        1
      )}s, adding to archive...`
    )

    const projectName = this.project.name.replace(/[^a-zA-Z0-9]/g, '_')
    archive.append(sddXml, { name: `${projectName}_sdd.xml` })
    console.log(
      `[SDD Export] XML added to archive (${(sddXml.length / 1024).toFixed(
        1
      )}KB)`
    )

    this.currentStep++
    console.log('[SDD Export] Step 3: Adding media files...')
    // Step 2: Add media files
    await this.addMediaFilesToArchive(archive)
    console.log('[SDD Export] Media files completed')

    this.currentStep++
    console.log('[SDD Export] Step 4: Adding matrix files...')
    // Step 3: Add matrix files (if any)
    await this.addMatrixFilesToArchive(archive)
    console.log('[SDD Export] Matrix files completed')

    this.currentStep++
    console.log('[SDD Export] Step 5: Adding project documents...')
    // Step 4: Add project documents
    await this.addProjectDocumentsToArchive(archive)
    console.log('[SDD Export] Project documents completed')

    this.currentStep++
    this.reportProgress('finalizing', 0, 1, 'Finalizing...')
    console.log('[SDD Export] Step 6: Finalizing archive...')

    // Finalize the archive
    await archive.finalize()
    console.log('[SDD Export] Archive finalized')

    this.reportProgress('completed', 1, 1, 'Complete')
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
          let mediaInfo = media.media
          // If it's a string, parse it; if it's already an object, use it directly
          if (typeof mediaInfo === 'string') {
            mediaInfo = JSON.parse(mediaInfo)
          }

          // Try to get filename and mimetype from any file size
          const fileSizes = ['original', 'large', 'thumbnail']
          let foundFilename = null
          let foundMimetype = null

          for (const fileSize of fileSizes) {
            if (mediaInfo[fileSize]) {
              const mediaVersion = mediaInfo[fileSize]
              if (!foundFilename && mediaVersion.ORIGINAL_FILENAME) {
                foundFilename = mediaVersion.ORIGINAL_FILENAME
              }
              if (!foundMimetype && mediaVersion.MIMETYPE) {
                foundMimetype = mediaVersion.MIMETYPE
              }
              if (foundFilename && foundMimetype) break
            }
          }

          // Fallback to top-level fields (legacy)
          if (!foundFilename && mediaInfo.ORIGINAL_FILENAME) {
            foundFilename = mediaInfo.ORIGINAL_FILENAME
          }
          if (!foundMimetype && mediaInfo.MIMETYPE) {
            foundMimetype = mediaInfo.MIMETYPE
          }

          media.filename = foundFilename || `M${media.media_id}`
          media.mimetype = foundMimetype || 'application/octet-stream'
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
   * Add media files to ZIP archive
   */
  async addMediaFilesToArchive(archive) {
    console.log('[SDD Export] Fetching media files list...')
    const mediaStartTime = Date.now()
    const media = await this.getMediaForDownload()
    const mediaFetchDuration = Date.now() - mediaStartTime
    console.log(
      `[SDD Export] Found ${media?.length || 0} media files (fetched in ${(
        mediaFetchDuration / 1000
      ).toFixed(1)}s)`
    )

    if (!media || media.length === 0) {
      this.reportProgress('adding_media', 0, 0, 'No media')
      console.log('[SDD Export] No media files to add')
      return
    }

    this.reportProgress('adding_media', 0, media.length, 'Adding media...')

    const s3Client = this.getS3Client()
    let processed = 0
    let added = 0

    for (let i = 0; i < media.length; i++) {
      const mediaItem = media[i]
      processed++

      // Log every 10 files or every 30 seconds
      if (i % 10 === 0 || i === 0) {
        process.stdout.write(
          `\n[Media Loop] Processing file ${i + 1}/${media.length} (media_id: ${
            mediaItem.media_id
          })\n`
        )
      }

      try {
        const fileSizeBytes = this.getMediaFileSize(mediaItem)
        const fileSize = this.formatFileSize(fileSizeBytes)
        const format = this.getMediaFormat(mediaItem)
        const mediaInfo = `M${mediaItem.media_id} (${format}, ${fileSize})`

        // Skip copyrighted media with restrictive licenses
        if (
          mediaItem.is_copyrighted === 1 &&
          mediaItem.copyright_license === 8
        ) {
          this.reportProgress(
            'adding_media',
            processed,
            media.length,
            `${processed}/${media.length} - Skipped ${mediaInfo}`
          )
          continue
        }

        this.reportProgress(
          'adding_media',
          processed,
          media.length,
          `${processed}/${media.length} - ${mediaInfo}`
        )

        // Add timeout wrapper for S3 download
        const downloadStartTime = Date.now()
        const SLOW_DOWNLOAD_THRESHOLD = 30000 // 30 seconds
        const STUCK_LOG_INTERVAL = 15000 // Log every 15 seconds if stuck
        const STUCK_LOG_INITIAL_DELAY = 10000 // Start logging after 10 seconds

        process.stdout.write(
          `\n[Download] Starting: media M${mediaItem.media_id} (${processed}/${media.length})\n`
        )

        const downloadPromise = this.downloadMediaFromS3(s3Client, mediaItem)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('S3 download timeout (5 minutes)')),
            300000
          )
        )

        // Heartbeat logging for stuck downloads
        let heartbeatInterval = null
        const startHeartbeat = () => {
          heartbeatInterval = setInterval(() => {
            const elapsed = Date.now() - downloadStartTime
            if (elapsed > STUCK_LOG_INITIAL_DELAY) {
              process.stdout.write(
                `\n[Download] ⏳ Still downloading media M${
                  mediaItem.media_id
                }... (${(elapsed / 1000).toFixed(0)}s elapsed)\n`
              )
            }
          }, STUCK_LOG_INTERVAL)
        }

        let downloadResult
        try {
          startHeartbeat()
          downloadResult = await Promise.race([downloadPromise, timeoutPromise])
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval)
            heartbeatInterval = null
          }

          const downloadDuration = Date.now() - downloadStartTime

          // Only log if download was slow or took a while
          if (downloadDuration > SLOW_DOWNLOAD_THRESHOLD) {
            console.log(
              `   ⚠️ Slow download: media M${mediaItem.media_id} took ${(
                downloadDuration / 1000
              ).toFixed(1)}s`
            )
          }
        } catch (error) {
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval)
            heartbeatInterval = null
          }
          const downloadDuration = Date.now() - downloadStartTime
          console.error(
            `   ❌ Failed to download media M${mediaItem.media_id} after ${(
              downloadDuration / 1000
            ).toFixed(1)}s: ${error.message}`
          )
          throw error
        }

        if (downloadResult && downloadResult.stream) {
          const filename = this.getMediaFilenameFromS3Key(
            downloadResult.s3Key,
            mediaItem
          )
          process.stdout.write(
            `\n[Archive] Adding media M${mediaItem.media_id} to archive: ${filename}\n`
          )

          const appendStartTime = Date.now()

          // Wrap archive.append in a promise to detect if it's blocking
          const appendPromise = new Promise((resolve, reject) => {
            try {
              archive.append(downloadResult.stream, {
                name: `media/${filename}`,
              })
              // archive.append() returns immediately, but we need to wait for the stream to finish
              // Let's add a timeout check
              const checkInterval = setInterval(() => {
                const elapsed = Date.now() - appendStartTime
                if (elapsed > 30000) {
                  process.stdout.write(
                    `\n[Archive] ⚠️ archive.append() still waiting for stream (${(
                      elapsed / 1000
                    ).toFixed(0)}s) - media M${mediaItem.media_id}\n`
                  )
                }
              }, 10000)

              // The stream should end naturally
              downloadResult.stream.on('end', () => {
                clearInterval(checkInterval)
                resolve()
              })

              downloadResult.stream.on('error', (err) => {
                clearInterval(checkInterval)
                reject(err)
              })

              // If stream doesn't end in 5 minutes, reject
              setTimeout(() => {
                clearInterval(checkInterval)
                reject(new Error('Stream did not end within 5 minutes'))
              }, 300000)
            } catch (err) {
              reject(err)
            }
          })

          await appendPromise
          const appendDuration = Date.now() - appendStartTime
          process.stdout.write(
            `[Archive] ✅ Completed adding media M${
              mediaItem.media_id
            } (took ${(appendDuration / 1000).toFixed(1)}s)\n`
          )
          added++
        } else {
          process.stdout.write(
            `\n[Archive] ⚠️ No stream returned for media M${mediaItem.media_id}, skipping...\n`
          )
        }
      } catch (error) {
        console.error(
          `Error adding media M${mediaItem.media_id}:`,
          error.message
        )
        // Continue with other files
      }
    }

    this.reportProgress(
      'adding_media',
      media.length,
      media.length,
      `${added} added`
    )
  }

  /**
   * Add matrix files to ZIP archive
   */
  async addMatrixFilesToArchive(archive) {
    const matrices = await this.getMatrices()

    if (!matrices || matrices.length === 0) {
      this.reportProgress('adding_matrices', 0, 0, 'No matrices')
      return
    }

    this.reportProgress(
      'adding_matrices',
      0,
      matrices.length,
      'Adding matrices...'
    )

    for (let i = 0; i < matrices.length; i++) {
      const matrix = matrices[i]

      try {
        this.reportProgress(
          'adding_matrices',
          i + 1,
          matrices.length,
          `${i + 1}/${matrices.length}`
        )

        // Generate NEXUS content using the matrix exporter
        const nexusContent = await this.generateMatrixNexusContent(
          matrix.matrix_id
        )

        if (nexusContent) {
          const filename = `X${matrix.matrix_id}_${matrix.title.replace(
            /[^a-zA-Z0-9]/g,
            '_'
          )}_morphobank.nex`
          archive.append(nexusContent, { name: `matrices/${filename}` })
        }
      } catch (error) {
        console.error(
          `Error processing matrix X${matrix.matrix_id}:`,
          error.message
        )
        // Continue with other matrices
      }
    }

    this.reportProgress(
      'adding_matrices',
      matrices.length,
      matrices.length,
      `${matrices.length} added`
    )
  }

  /**
   * Generate NEXUS content for a matrix using the NEXUS exporter
   */
  async generateMatrixNexusContent(matrixId) {
    try {
      // Get matrix data using matrix service functions
      const options = new ExportOptions()
      options.matrix = await matrixService.getMatrix(matrixId)
      options.includeNotes = false
      options.taxa = await matrixService.getTaxaInMatrix(matrixId)
      options.characters = await matrixService.getCharactersInMatrix(matrixId)
      options.cellsTable = await matrixService.getCells(matrixId)
      options.cellNotes = null
      options.blocks = await matrixService.getMatrixBlocks(matrixId)

      // Generate NEXUS content
      let nexusContent = ''
      const exporter = new NexusExporter((txt) => {
        nexusContent += txt
      })

      exporter.export(options)
      return nexusContent
    } catch (error) {
      console.error(
        `Error generating NEXUS content for matrix ${matrixId}:`,
        error.message
      )
      return null
    }
  }

  /**
   * Add project documents to ZIP archive
   */
  async addProjectDocumentsToArchive(archive) {
    const documents = await this.getProjectDocuments()

    if (!documents || documents.length === 0) {
      this.reportProgress('adding_documents', 0, 0, 'No documents')
      return
    }

    this.reportProgress(
      'adding_documents',
      0,
      documents.length,
      'Adding documents...'
    )

    const s3Client = this.getS3Client()
    let added = 0

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i]

      try {
        this.reportProgress(
          'adding_documents',
          i + 1,
          documents.length,
          `${i + 1}/${documents.length}`
        )

        const downloadResult = await this.downloadDocumentFromS3(s3Client, doc)
        if (downloadResult && downloadResult.stream) {
          const filename = this.getDocumentFilenameFromS3Key(
            downloadResult.s3Key,
            doc
          )
          archive.append(downloadResult.stream, {
            name: `documents/${filename}`,
          })
          added++
        }
      } catch (error) {
        console.error(
          `Error adding document ${doc.document_id}:`,
          error.message
        )
      }
    }

    this.reportProgress(
      'adding_documents',
      documents.length,
      documents.length,
      `${added} added`
    )
  }

  /**
   * Get S3 client instance
   */
  getS3Client() {
    if (!config.aws.accessKeyId || !config.aws.secretAccessKey) {
      throw new Error('AWS credentials not configured')
    }

    const requestHandler = new NodeHttpHandler({
      requestTimeout: 300000, // 5 minutes per request
      connectionTimeout: 30000, // 30 seconds to connect
    })

    return new S3Client({
      region: config.aws.region || 'us-west-2',
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
      requestHandler,
      maxAttempts: 3,
      retryMode: 'adaptive',
    })
  }

  /**
   * Download media file from S3
   */
  async downloadMediaFromS3(s3Client, mediaItem) {
    try {
      // Get media info (could be JSON string or already parsed object)
      let s3Key = null
      if (mediaItem.media) {
        try {
          let mediaInfo = mediaItem.media
          // If it's a string, parse it; if it's already an object, use it directly
          if (typeof mediaInfo === 'string') {
            mediaInfo = JSON.parse(mediaInfo)
          }
          // Media data structure: { original: {S3_KEY: "..."}, large: {S3_KEY: "..."}, thumbnail: {S3_KEY: "..."} }
          // Try different file sizes in order of preference
          const fileSizes = ['original', 'large', 'thumbnail']
          for (const fileSize of fileSizes) {
            if (mediaInfo[fileSize]) {
              const mediaVersion = mediaInfo[fileSize]
              if (mediaVersion.S3_KEY) {
                s3Key = mediaVersion.S3_KEY
                break
              } else if (mediaVersion.FILENAME) {
                // Legacy system - construct S3 key
                const fileExtension =
                  mediaVersion.FILENAME.split('.').pop() || 'jpg'
                const fileName = `${mediaItem.project_id}_${mediaItem.media_id}_${fileSize}.${fileExtension}`
                s3Key = `media_files/images/${mediaItem.project_id}/${mediaItem.media_id}/${fileName}`
                break
              }
            }
          }
        } catch (e) {
          console.error(
            `Error parsing media JSON for M${mediaItem.media_id}:`,
            e.message
          )
        }
      }

      if (!s3Key) {
        return null
      }

      const command = new GetObjectCommand({
        Bucket: config.aws.defaultBucket || config.aws.bucketName,
        Key: s3Key,
      })

      const response = await s3Client.send(command)
      return {
        stream: response.Body,
        s3Key: s3Key,
      }
    } catch (error) {
      console.error(
        `Error downloading media M${mediaItem.media_id} from S3:`,
        error.message
      )
      return null
    }
  }

  /**
   * Download document from S3
   */
  async downloadDocumentFromS3(s3Client, document) {
    try {
      // Get document upload info (could be JSON string or already parsed object)
      let s3Key = null
      if (document.upload) {
        try {
          let uploadInfo = document.upload
          // If it's a string, parse it; if it's already an object, use it directly
          if (typeof uploadInfo === 'string') {
            uploadInfo = JSON.parse(uploadInfo)
          }
          s3Key = uploadInfo.s3_key || uploadInfo.S3_KEY

          // If no S3 key found, construct it based on the document structure
          if (!s3Key && uploadInfo.ORIGINAL_FILENAME) {
            const fileExtension =
              uploadInfo.ORIGINAL_FILENAME.split('.').pop() || 'bin'
            const fileName = `${document.project_id}_${document.document_id}_original.${fileExtension}`
            s3Key = `documents/${document.project_id}/${document.document_id}/${fileName}`
          }
        } catch (e) {
          console.error(
            `Error parsing document JSON for ${document.document_id}:`,
            e.message
          )
        }
      }

      if (!s3Key) {
        return null
      }

      const command = new GetObjectCommand({
        Bucket: config.aws.defaultBucket || config.aws.bucketName,
        Key: s3Key,
      })

      const response = await s3Client.send(command)
      return {
        stream: response.Body,
        s3Key: s3Key,
      }
    } catch (error) {
      console.error(
        `Error downloading document ${document.document_id} from S3:`,
        error.message
      )
      return null
    }
  }

  /**
   * Get media filename from S3 key
   */
  getMediaFilenameFromS3Key(s3Key, mediaItem) {
    if (s3Key) {
      // Extract filename from S3 key path
      const s3Filename = path.basename(s3Key)
      if (s3Filename && s3Filename !== s3Key) {
        return s3Filename
      }
    }

    // Fallback to original method
    return this.getMediaFilename(mediaItem)
  }

  /**
   * Get media filename for archive (fallback method)
   */
  getMediaFilename(mediaItem) {
    let filename = `M${mediaItem.media_id}`

    if (mediaItem.media) {
      try {
        let mediaInfo = mediaItem.media
        // If it's a string, parse it; if it's already an object, use it directly
        if (typeof mediaInfo === 'string') {
          mediaInfo = JSON.parse(mediaInfo)
        }

        // Try to get original filename from any file size
        const fileSizes = ['original', 'large', 'thumbnail']
        for (const fileSize of fileSizes) {
          if (mediaInfo[fileSize]) {
            const mediaVersion = mediaInfo[fileSize]
            if (mediaVersion.ORIGINAL_FILENAME) {
              const ext = path.extname(mediaVersion.ORIGINAL_FILENAME)
              filename = `M${mediaItem.media_id}_${path.basename(
                mediaVersion.ORIGINAL_FILENAME,
                ext
              )}${ext}`
              break
            } else if (mediaVersion.FILENAME) {
              filename = `M${mediaItem.media_id}_${mediaVersion.FILENAME}`
              break
            }
          }
        }

        // Fallback: check for top-level ORIGINAL_FILENAME (legacy)
        if (
          filename === `M${mediaItem.media_id}` &&
          mediaInfo.ORIGINAL_FILENAME
        ) {
          const ext = path.extname(mediaInfo.ORIGINAL_FILENAME)
          filename = `M${mediaItem.media_id}_${path.basename(
            mediaInfo.ORIGINAL_FILENAME,
            ext
          )}${ext}`
        }
      } catch (e) {
        // Use default filename
      }
    }

    return filename
  }

  /**
   * Get document filename from S3 key
   */
  getDocumentFilenameFromS3Key(s3Key, document) {
    if (s3Key) {
      // Extract filename from S3 key path
      const s3Filename = path.basename(s3Key)
      if (s3Filename && s3Filename !== s3Key) {
        return s3Filename
      }
    }

    // Fallback to original method
    return this.getDocumentFilename(document)
  }

  /**
   * Get document filename for archive (fallback method)
   */
  getDocumentFilename(document) {
    let filename = `D${document.document_id}`

    if (document.upload) {
      try {
        let uploadInfo = document.upload
        // If it's a string, parse it; if it's already an object, use it directly
        if (typeof uploadInfo === 'string') {
          uploadInfo = JSON.parse(uploadInfo)
        }

        const originalFilename = uploadInfo.ORIGINAL_FILENAME
        if (originalFilename) {
          filename = path.basename(originalFilename)
        }
      } catch (e) {
        // Use default filename
      }
    }

    return filename
  }

  /**
   * Get media files for download (with copyright filtering)
   */
  async getMediaForDownload() {
    let whereClause = `project_id = ${this.projectId} AND published = 0`

    if (this.project.publish_matrix_media_only) {
      whereClause += ` AND in_use_in_matrix = 1`
    }

    const [results] = await sequelizeConn.query(`
      SELECT media_id, project_id, media, is_copyrighted, copyright_license, media_type
      FROM media_files 
      WHERE ${whereClause}
      ORDER BY media_id
    `)

    return results
  }

  /**
   * Get project documents
   */
  async getProjectDocuments() {
    const [results] = await sequelizeConn.query(
      `
      SELECT document_id, project_id, title, upload
      FROM project_documents
      WHERE project_id = ? AND published = 0
      ORDER BY document_id
    `,
      {
        replacements: [this.projectId],
      }
    )

    return results
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
