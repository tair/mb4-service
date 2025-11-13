import * as publishedProjectService from '../services/published-projects-service.js'
import * as taxaService from '../services/taxa-service.js'
import * as mediaService from '../services/media-service.js'
import sequelizeConn from '../util/db.js'
import { Sequelize } from 'sequelize'
import s3Service from '../services/s3-service.js'
import config from '../config.js'
import BibliographicReference from '../models/bibliographic-reference.js'

/**
 * Transform projects dump data to match the API specification
 * @param {Array} projectsData - Raw projects data from getProjects
 * @returns {Array} Transformed projects data for API response
 */
function transformProjectsDataForAPI(projectsData) {
  return projectsData.map(project => {
    // Use project_stats which contains accurate counts from the dump data
    const stats = project.project_stats || {}
    
    // Format dates as ISO strings (convert from Unix timestamp if needed)
    // Check for > 0 since 0 is the default for old projects without proper date tracking
    const creationDate = project.created_on && project.created_on > 0
      ? new Date(project.created_on * 1000).toISOString() 
      : null
    const publicationDate = project.published_on && project.published_on > 0
      ? new Date(project.published_on * 1000).toISOString() 
      : null
    
    return {
      project_id: project.project_id.toString(),
      name: project.article_title || project.name || '',
      media_count: stats.media || 0,
      taxonomy_count: stats.taxa || 0,
      matrices_count: stats.matrices || 0,
      creation_date: creationDate,
      publication_date: publicationDate,
      doi: project.project_doi || '',
      authors: project.article_authors || '',
      // Use the new site path structure
      url: `${config.app.frontendDomain}/project/${project.project_id}/overview`
    }
  })
}

/**
 * Transform media dump data to match the API specification
 * @param {Array} mediaData - Raw media data from getMediaFileDump
 * @param {string} projectId - Project ID for URL generation
 * @returns {Array} Transformed media data for API response
 */
function transformMediaDataForAPI(mediaData, projectId) {
  return mediaData.map(item => {
    // Extract specimen information
    const specimen = item.specimen || {}
    let specimenName = ''
    if (specimen.institution_code || specimen.collection_code || specimen.catalog_number) {
      const parts = []
      if (specimen.institution_code) parts.push(specimen.institution_code)
      if (specimen.collection_code) parts.push(specimen.collection_code)
      if (specimen.catalog_number) parts.push(specimen.catalog_number)
      specimenName = `${item.taxon_name || ''} (${parts.join(':')})`
    } else if (item.specimen_name) {
      specimenName = item.specimen_name
    }

    // Clean up HTML tags from taxonomy
    const taxonomy = item.taxon_name ? item.taxon_name.replace(/<\/?i>/g, '') : ''
    
    // Extract taxon ID from taxon_sort_fields if available
    const taxonSortFields = item.taxon_sort_fields || {}
    
    // Determine copyright status
    const isCopyrighted = item.copyright_holder ? 'Yes' : 'No'
    
    // Use license description from dump data
    const copyrightLicense = item.license?.description || ''

    return {
      media_id: item.media_id.toString(),
      view: item.view_name || '',
      taxon_id: item.taxon_id ? item.taxon_id.toString() : '',
      taxonomy: taxonomy,
      specimen_id: item.specimen_id ? item.specimen_id.toString() : '',
      specimen: specimenName.replace(/<\/?i>/g, ''), // Remove HTML tags
      is_copyrighted: isCopyrighted,
      copyright_permission: item.copyright_permission || '',
      copyright_license: copyrightLicense,
      copyright_holder: item.copyright_holder || '',
      notes: item.notes || '',
      web_source: item.url || '',
      web_source_description: item.url_description || '',
      citation: item.references || [],
      url: `${config.app.frontendDomain}/project/${projectId}/media/${item.media_id}`
    }
  })
}

export async function handleApiRequest(req, res) {
  try {
    const { command, resourceType } = req.params
    
    // Only support List command for now (as specified in API documentation)
    if (command !== 'List') {
      return res.status(400).json({
        ok: false,
        status: 'err',
        error: `Unsupported command: ${command}. Only 'List' command is supported.`
      })
    }

    // Route to appropriate handler based on resource type
    switch (resourceType) {
      case 'PublishedProjects':
        return await handlePublishedProjects(req, res)
      case 'ProjectMedia':
        return await handleProjectMedia(req, res)
      case 'ProjectTaxonomy':
        return await handleProjectTaxonomy(req, res)
      default:
        return res.status(400).json({
          ok: false,
          status: 'err',
          error: `Unsupported resource type: ${resourceType}. Supported types are: PublishedProjects, ProjectMedia, ProjectTaxonomy.`
        })
    }
  } catch (error) {
    console.error('API Service Error:', error)
    return res.status(500).json({
      ok: false,
      status: 'err',
      error: 'Internal server error'
    })
  }
}

async function handlePublishedProjects(req, res) {
  try {
    // Fetch projects data from S3 using the S3 service directly
    const bucket = config.aws.defaultBucket
    const s3Key = 'projects.json'
    
    if (!bucket) {
      throw new Error('Default S3 bucket not configured')
    }
    
    const s3Result = await s3Service.getObject(bucket, s3Key)
    const projectsData = JSON.parse(s3Result.data.toString())

    // Transform the S3 data to match the API specification
    const results = transformProjectsDataForAPI(projectsData)

    return res.status(200).json({
      ok: true,
      status: 'ok',
      totalResults: results.length,
      results: results
    })
  } catch (error) {
    console.error('Error in handlePublishedProjects:', error)
    
    // If S3 service is unavailable, fall back to database query
    if (error.name === 'NoSuchKey' || error.name === 'NoSuchBucket' || error.message.includes('not configured')) {
      console.log('S3 projects.json not available, falling back to database query')
      return await handlePublishedProjectsFallback(req, res)
    }
    
    return res.status(500).json({
      ok: false,
      status: 'err',
      error: 'Error while fetching published projects'
    })
  }
}

// Fallback method using publishedProjectService.getProjects
async function handlePublishedProjectsFallback(req, res) {
  try {
    // Use the same getProjects service that's used for data dumps
    const projectsData = await publishedProjectService.getProjects()

    // Transform the data using the shared transformation method
    const results = transformProjectsDataForAPI(projectsData)

    return res.status(200).json({
      ok: true,
      status: 'ok',
      totalResults: results.length,
      results: results
    })
  } catch (error) {
    console.error('Error in handlePublishedProjectsFallback:', error)
    return res.status(500).json({
      ok: false,
      status: 'err',
      error: 'Error while fetching published projects'
    })
  }
}

async function handleProjectMedia(req, res) {
  try {
    const projectId = req.query.project_id
    
    if (!projectId) {
      return res.status(400).json({
        ok: false,
        status: 'err',
        error: 'project_id parameter is required for ProjectMedia'
      })
    }

    // Fetch project media data from S3 using the S3 service directly
    const bucket = config.aws.defaultBucket
    const s3Key = `media_files/prj_${projectId}.json`
    
    if (!bucket) {
      throw new Error('Default S3 bucket not configured')
    }
    
    let mediaData
    try {
      const s3Result = await s3Service.getObject(bucket, s3Key)
      mediaData = JSON.parse(s3Result.data.toString())
    } catch (s3Error) {
      // If S3 media file doesn't exist, project might not be published or have no media
      if (s3Error.name === 'NoSuchKey') {
        // Verify if project exists and is published using fallback
        return await handleProjectMediaFallback(req, res)
      }
      throw s3Error
    }

    // Transform the S3 media data to match the API specification
    const results = transformMediaDataForAPI(mediaData, projectId)

    return res.status(200).json({
      ok: true,
      status: 'ok',
      totalResults: results.length,
      parameters: {
        project_id: projectId
      },
      results: results
    })
  } catch (error) {
    console.error('Error in handleProjectMedia:', error)
    
    // If S3 service is unavailable, fall back to database query
    if (error.name === 'NoSuchKey' || error.name === 'NoSuchBucket' || error.message.includes('not configured')) {
      console.log('S3 media file not available, falling back to database query')
      return await handleProjectMediaFallback(req, res)
    }
    
    return res.status(500).json({
      ok: false,
      status: 'err',
      error: 'Error while fetching project media'
    })
  }
}

// Fallback method using mediaService.getMediaFileDump for ProjectMedia
async function handleProjectMediaFallback(req, res) {
  try {
    const projectId = req.query.project_id

    // Verify project is published
    const [projectCheck] = await sequelizeConn.query(`
      SELECT project_id FROM projects 
      WHERE project_id = ? AND published = 1 AND deleted = 0
    `, { replacements: [projectId] })

    if (projectCheck.length === 0) {
      return res.status(404).json({
        ok: false,
        status: 'err',
        error: 'Project not found or not published'
      })
    }

    // Use the same getMediaFileDump service that's used for data dumps
    const mediaData = await mediaService.getMediaFileDump(projectId)

    // Transform the data using the shared transformation method
    const results = transformMediaDataForAPI(mediaData, projectId)

    return res.status(200).json({
      ok: true,
      status: 'ok',
      totalResults: results.length,
      parameters: {
        project_id: projectId
      },
      results: results
    })
  } catch (error) {
    console.error('Error in handleProjectMediaFallback:', error)
    return res.status(500).json({
      ok: false,
      status: 'err',
      error: 'Error while fetching project media'
    })
  }
}

/**
 * Project Taxonomy API method - equivalent to PHP ProjectTaxonomy()
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handleProjectTaxonomy(req, res) {
  try {
    const projectId = req.query.project_id
    
    // Validate project_id parameter
    if (!projectId || !Number.isInteger(parseInt(projectId)) || parseInt(projectId) <= 0) {
      return res.status(400).json({
        ok: false,
        status: 'err',
        error: 'no project_id passed'
      })
    }

    const parsedProjectId = parseInt(projectId)

    // Verify project is published
    const [projectCheck] = await sequelizeConn.query(`
      SELECT project_id FROM projects 
      WHERE project_id = ? AND published = 1 AND deleted = 0
    `, { replacements: [parsedProjectId] })

    if (projectCheck.length === 0) {
      return res.status(404).json({
        ok: false,
        status: 'err',
        error: 'Project not found or not published'
      })
    }

    // Main query to get all taxa for the project
    const taxaQuery = `
      SELECT 
        t.taxon_id, t.is_extinct, t.genus, t.specific_epithet, 
        t.supraspecific_clade, t.higher_taxon_kingdom, t.higher_taxon_phylum, 
        t.higher_taxon_class, t.higher_taxon_subclass, t.higher_taxon_infraclass, 
        t.higher_taxon_cohort, t.higher_taxon_superorder, t.higher_taxon_order, 
        t.higher_taxon_suborder, t.higher_taxon_infraorder, t.higher_taxon_superfamily, 
        t.higher_taxon_family, t.higher_taxon_subfamily, t.higher_taxon_tribe, 
        t.higher_taxon_subtribe, t.subgenus, t.subspecific_epithet, 
        t.scientific_name_author, t.scientific_name_year, t.use_parens_for_author, 
        t.notes
      FROM taxa t
      WHERE (t.project_id = ?) 
      ORDER BY t.taxon_id
    `
    
    const [taxaRows] = await sequelizeConn.query(taxaQuery, { replacements: [parsedProjectId] })
    
    if (taxaRows.length === 0) {
      return res.status(200).json({
        ok: true,
        status: 'ok',
        totalResults: 0,
        parameters: { project_id: parsedProjectId },
        results: []
      })
    }

    // Get all usage counts and citations for the project in bulk
    const usageCountsMap = await getBulkTaxonUsageCounts(parsedProjectId)
    const citationsMap = await getBulkTaxonCitations(parsedProjectId)
    
    const taxaResults = []
    
    // Process each taxon record
    for (const taxaRow of taxaRows) {
      // Generate scientific name
      const scientificName = formatTaxonName(taxaRow)
      
      // Get usage count from map
      const usageCount = usageCountsMap.get(taxaRow.taxon_id) || { total: 0 }
      
      // Get bibliographic citations from map
      const citation = citationsMap.get(taxaRow.taxon_id) || ""
      
      // Build taxon item response (matches PHP structure exactly)
      const taxonItem = {
        taxon_id: taxaRow.taxon_id.toString(),
        is_extinct: taxaRow.is_extinct ? '1' : '0',
        genus: taxaRow.genus || '',
        specific_epithet: taxaRow.specific_epithet || '',
        supraspecific_clade: taxaRow.supraspecific_clade || '',
        higher_taxon_kingdom: taxaRow.higher_taxon_kingdom || '',
        higher_taxon_phylum: taxaRow.higher_taxon_phylum || '',
        higher_taxon_class: taxaRow.higher_taxon_class || '',
        higher_taxon_subclass: taxaRow.higher_taxon_subclass || '',
        higher_taxon_infraclass: taxaRow.higher_taxon_infraclass || '',
        higher_taxon_cohort: taxaRow.higher_taxon_cohort || '',
        higher_taxon_superorder: taxaRow.higher_taxon_superorder || '',
        higher_taxon_order: taxaRow.higher_taxon_order || '',
        higher_taxon_suborder: taxaRow.higher_taxon_suborder || '',
        higher_taxon_infraorder: taxaRow.higher_taxon_infraorder || '',
        higher_taxon_superfamily: taxaRow.higher_taxon_superfamily || '',
        higher_taxon_family: taxaRow.higher_taxon_family || '',
        higher_taxon_subfamily: taxaRow.higher_taxon_subfamily || '',
        higher_taxon_tribe: taxaRow.higher_taxon_tribe || '',
        higher_taxon_subtribe: taxaRow.higher_taxon_subtribe || '',
        subgenus: taxaRow.subgenus || '',
        subspecific_epithet: taxaRow.subspecific_epithet || '',
        scientific_name_author: taxaRow.scientific_name_author || '',
        scientific_name_year: taxaRow.scientific_name_year ? taxaRow.scientific_name_year.toString() : '0',
        use_parens_for_author: taxaRow.use_parens_for_author ? '1' : '0',
        notes: taxaRow.notes || '',
        scientific_name: scientificName,
        usage: usageCount,
        citation: citation
      }
      
      taxaResults.push(taxonItem)
    }
    
    return res.status(200).json({
      ok: true,
      status: 'ok',
      totalResults: taxaResults.length,
      parameters: {
        project_id: parsedProjectId
      },
      results: taxaResults
    })
    
  } catch (error) {
    console.error('Error in handleProjectTaxonomy:', error)
    return res.status(500).json({
      ok: false,
      status: 'err',
      error: 'Database error occurred'
    })
  }
}

/**
 * Format taxon name with extinction marker and taxonomic components
 * @param {Object} taxaRow - Taxon data row
 * @returns {string} Formatted scientific name
 */
function formatTaxonName(taxaRow) {
  if (!taxaRow.genus) return ''
  
  let scientificName = ''
  
  // Add extinction marker if extinct
  if (taxaRow.is_extinct) {
    scientificName += '†'
  }
  
  // Add genus
  scientificName += taxaRow.genus
  
  // Add specific epithet if present
  if (taxaRow.specific_epithet) {
    scientificName += ' ' + taxaRow.specific_epithet
  }
  
  // Add subspecific epithet if present
  if (taxaRow.subspecific_epithet) {
    scientificName += ' ' + taxaRow.subspecific_epithet
  }
  
  return scientificName
}

/**
 * Get usage counts for all taxa in a project in bulk
 * @param {number} projectId - Project ID
 * @returns {Map} Map of taxon_id -> usage count object
 */
async function getBulkTaxonUsageCounts(projectId) {
  try {
    const usageCountsMap = new Map()
    
    // Define linking tables for taxa (from PHP getLinkingTableNames)
    const linkingTables = [
      { table: 'taxa_x_media', column: 'media_id', name: 'media' },
      { table: 'taxa_x_specimens', column: 'specimen_id', name: 'specimens' },
      { table: 'taxa_x_bibliographic_references', column: 'reference_id', name: 'bibliographic_references' },
      { table: 'taxa_x_partitions', column: 'partition_id', name: 'partitions' },
      { table: 'matrix_taxa_order', column: 'matrix_id', name: 'matrices' }
    ]
    
    // Initialize usage counts for all taxa in the project
    const [allTaxa] = await sequelizeConn.query(`
      SELECT taxon_id FROM taxa WHERE project_id = ?
    `, { replacements: [projectId] })
    
    for (const taxon of allTaxa) {
      usageCountsMap.set(taxon.taxon_id, { 
        total: 0, 
        media: 0, 
        specimens: 0, 
        bibliographic_references: 0, 
        partitions: 0, 
        matrices: 0 
      })
    }
    
    // Count records in each linking table for all taxa at once
    for (const linkTable of linkingTables) {
      const countQuery = `
        SELECT lt.taxon_id, COUNT(*) as c
        FROM ${linkTable.table} lt
        INNER JOIN taxa t ON lt.taxon_id = t.taxon_id
        WHERE t.project_id = ?
        GROUP BY lt.taxon_id
      `
      
      const [countRows] = await sequelizeConn.query(countQuery, { replacements: [projectId] })
      
      for (const row of countRows) {
        const usageCount = usageCountsMap.get(row.taxon_id)
        if (usageCount) {
          const count = parseInt(row.c)
          usageCount.total += count
          usageCount[linkTable.name] = count
        }
      }
    }
    
    // Additional count for media files linked through specimens (from PHP logic)
    const mediaViaSpecimensQuery = `
      SELECT txs.taxon_id, COUNT(*) as c
      FROM media_files mf
      INNER JOIN taxa_x_specimens AS txs ON mf.specimen_id = txs.specimen_id
      INNER JOIN taxa t ON txs.taxon_id = t.taxon_id
      WHERE t.project_id = ?
      GROUP BY txs.taxon_id
    `
    
    const [mediaRows] = await sequelizeConn.query(mediaViaSpecimensQuery, { replacements: [projectId] })
    
    for (const row of mediaRows) {
      const usageCount = usageCountsMap.get(row.taxon_id)
      if (usageCount) {
        const mediaViaSpecimens = parseInt(row.c)
        usageCount.total += mediaViaSpecimens
        usageCount.media += mediaViaSpecimens
      }
    }
    
    return usageCountsMap
    
  } catch (error) {
    console.error('Error calculating bulk taxon usage counts:', error)
    return new Map()
  }
}

/**
 * Get bibliographic citations for all taxa in a project in bulk
 * @param {number} projectId - Project ID
 * @returns {Map} Map of taxon_id -> citation string
 */
async function getBulkTaxonCitations(projectId) {
  try {
    const citationsMap = new Map()
    
    // Get all bibliographic references for taxa in this project
    const refQuery = `
      SELECT 
        txbr.taxon_id,
        br.reference_id,
        br.article_title, 
        br.journal_title,
        br.monograph_title,
        br.authors,
        br.secondary_authors,
        br.editors,
        br.pubyear, 
        br.vol, 
        br.num,
        br.publisher,
        br.place_of_publication,
        br.sect,
        br.edition,
        br.collation
      FROM bibliographic_references br
      INNER JOIN taxa_x_bibliographic_references AS txbr 
        ON txbr.reference_id = br.reference_id
      INNER JOIN taxa t ON txbr.taxon_id = t.taxon_id
      WHERE t.project_id = ?
      ORDER BY txbr.taxon_id, br.reference_id
    `
    
    const [refRows] = await sequelizeConn.query(refQuery, { replacements: [projectId] })
    
    // Group citations by taxon_id
    const citationsByTaxon = new Map()
    
    for (const row of refRows) {
      if (!citationsByTaxon.has(row.taxon_id)) {
        citationsByTaxon.set(row.taxon_id, [])
      }
      
      // Use the existing BibliographicReference.getCitationText method
      const citationText = BibliographicReference.getCitationText(row, null)
      
      if (citationText && citationText.trim()) {
        citationsByTaxon.get(row.taxon_id).push(citationText.trim())
      }
    }
    
    // Convert arrays to semicolon-separated strings
    for (const [taxonId, citations] of citationsByTaxon) {
      citationsMap.set(taxonId, citations.join(";"))
    }
    
    return citationsMap
    
  } catch (error) {
    console.error('Error getting bulk taxon citations:', error)
    return new Map()
  }
}


