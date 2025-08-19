import axios from 'axios'
import FormData from 'form-data'
import { TNTTreeBuilderExporter } from '../lib/matrix-export/tnt-treebuilder-export.js'
import { ExportOptions } from '../lib/matrix-export/exporter.js'
import * as matrixService from '../services/matrix-service.js'
import { cacheTntContent, getTntContent } from '../util/tnt-cache.js'

/**
 * Validate TNT file
 */
async function validateTntFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        valid: false,
        error: 'No file uploaded',
      })
    }

    // Create FormData to send to TNT server
    const formData = new FormData()
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    })

    // Forward request to TNT server
    const response = await axios.post(
      `${process.env.TNT_SERVER_URL}/tnt/validate`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 30000, // 30 second timeout
      }
    )

    return res.status(200).json(response.data)
  } catch (error) {
    console.error('Error validating TNT file:', {
      message: error.message,
      code: error.code,
      url: process.env.TNT_SERVER_URL,
      stack: error.stack,
    })

    if (error.response) {
      // TNT server responded with an error
      console.error('TNT server response error:', {
        status: error.response.status,
        data: error.response.data,
      })
      return res.status(error.response.status).json({
        valid: false,
        error: error.response.data?.error || 'TNT server validation failed',
      })
    } else if (error.code === 'ECONNREFUSED') {
      console.error(
        `TNT server connection refused. Check if TNT server is running at: ${process.env.TNT_SERVER_URL}`
      )
      return res.status(503).json({
        valid: false,
        error: `TNT server is not available at ${process.env.TNT_SERVER_URL}`,
      })
    } else {
      console.error('Unexpected error during TNT validation:', error)
      return res.status(500).json({
        valid: false,
        error: 'Internal server error during validation',
      })
    }
  }
}

/**
 * Extract species names from TNT file
 */
async function extractSpecies(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
      })
    }

    // Create FormData to send to TNT server
    const formData = new FormData()
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    })

    // Forward request to TNT server
    const response = await axios.post(
      `${process.env.TNT_SERVER_URL}/tnt/species`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 30000, // 30 second timeout
      }
    )

    return res.status(200).json(response.data)
  } catch (error) {
    console.error('Error extracting species from TNT file:', {
      message: error.message,
      code: error.code,
      url: process.env.TNT_SERVER_URL,
      stack: error.stack,
    })

    if (error.response) {
      // TNT server responded with an error
      console.error('TNT server response error:', {
        status: error.response.status,
        data: error.response.data,
      })
      return res.status(error.response.status).json({
        error:
          error.response.data?.error || 'TNT server species extraction failed',
      })
    } else if (error.code === 'ECONNREFUSED') {
      console.error(
        `TNT server connection refused. Check if TNT server is running at: ${process.env.TNT_SERVER_URL}`
      )
      return res.status(503).json({
        error: `TNT server is not available at ${process.env.TNT_SERVER_URL}`,
      })
    } else {
      console.error('Unexpected error during TNT species extraction:', error)
      return res.status(500).json({
        error: 'Internal server error during species extraction',
      })
    }
  }
}

/**
 * Analyze TNT file
 */
async function analyzeTntFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
      })
    }

    // Create FormData to send to TNT server
    const formData = new FormData()
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    })

    // Add other form parameters
    if (req.body.outgroup) {
      formData.append('outgroup', req.body.outgroup)
    }
    if (req.body.hold_value) {
      formData.append('hold_value', req.body.hold_value)
    }
    if (req.body.search_type) {
      formData.append('search_type', req.body.search_type)
    }

    // Add search-specific parameters
    if (req.body.search_type === 'traditional') {
      if (req.body.replications) {
        formData.append('replications', req.body.replications)
      }
      if (req.body.trees_per_replication) {
        formData.append('trees_per_replication', req.body.trees_per_replication)
      }
    } else if (req.body.search_type === 'new_technology') {
      if (req.body.iterations) {
        formData.append('iterations', req.body.iterations)
      }
    }

    // Forward request to TNT server
    const response = await axios.post(
      `${process.env.TNT_SERVER_URL}/tnt/analyze`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 300000, // 5 minute timeout for analysis
      }
    )

    // Return the analysis results (typically NEXUS format)
    return res.status(200).send(response.data)
  } catch (error) {
    if (error.response) {
      console.error('TNT server response error:', {
        status: error.response.status,
        data: error.response.data,
      })
      return res.status(error.response.status).json({
        error: error.response.data?.detail || 'TNT server analysis failed',
      })
    } else {
      console.error('Error analyzing TNT file:', error)
      return res.status(500).json({
        error: 'Internal server error during TNT analysis',
      })
    }
  }
}

/**
 * Download matrix data in TNT format using TNTTreeBuilderExporter
 */
async function download(req, res) {
  const matrixId = parseInt(req.params.matrixId)
  if (!matrixId) {
    res.status(400).json({ message: 'The request must contain a matrix ID.' })
    return
  }

  try {
    // Set up response headers for file download
    const filename = `matrix_${matrixId}_tnt_${getFilenameDate()}.tnt`
    res.set({
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'attachment; filename=' + filename,
      'Cache-Control': 'private',
      'Last-Modified': new Date(),
      Pragma: 'no-store',
    })
    res.status(200)

    // Create TNT TreeBuilder exporter
    const exporter = new TNTTreeBuilderExporter((txt) => res.write(txt))

    // Prepare export options
    const options = new ExportOptions()
    options.matrix = await matrixService.getMatrix(matrixId)
    options.taxa = await matrixService.getTaxaInMatrix(matrixId)
    options.characters = await matrixService.getCharactersInMatrix(matrixId)
    options.cellsTable = await matrixService.getCells(matrixId)

    // Export the data
    exporter.export(options)
    res.end()
  } catch (error) {
    console.error('Error downloading TNT matrix:', {
      matrixId,
      message: error.message,
      stack: error.stack,
    })

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error during TNT matrix download',
      })
    }
  }
}

/**
 * Helper function to generate filename date
 */
function getFilenameDate() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}_${hours}${minutes}${seconds}`
}

/**
 * Convert matrix to TNT format, validate it, and extract species in one call
 */
async function validateMatrixAndExtractSpecies(req, res) {
  const matrixId = parseInt(req.params.matrixId)
  if (!matrixId) {
    return res.status(400).json({
      valid: false,
      error: 'The request must contain a matrix ID.',
    })
  }

  try {
    // Step 1: Convert matrix to TNT format
    let tntContent = ''
    const exporter = new TNTTreeBuilderExporter((txt) => {
      tntContent += txt
    })

    // Prepare export options
    const options = new ExportOptions()
    options.matrix = await matrixService.getMatrix(matrixId)
    options.taxa = await matrixService.getTaxaInMatrix(matrixId)
    options.characters = await matrixService.getCharactersInMatrix(matrixId)
    options.cellsTable = await matrixService.getCells(matrixId)

    // Export the data to TNT format
    exporter.export(options)

    if (!tntContent) {
      return res.status(400).json({
        valid: false,
        error: 'Failed to generate TNT content from matrix',
      })
    }

    // Step 2: Create buffer from TNT content for validation
    const tntBuffer = Buffer.from(tntContent, 'utf-8')

    // Step 3: Validate the TNT content
    const validationFormData = new FormData()
    validationFormData.append('file', tntBuffer, {
      filename: `matrix_${matrixId}.tnt`,
      contentType: 'text/plain',
    })

    let validationResponse
    try {
      validationResponse = await axios.post(
        `${process.env.TNT_SERVER_URL}/tnt/validate`,
        validationFormData,
        {
          headers: {
            ...validationFormData.getHeaders(),
          },
          timeout: 30000, // 30 second timeout
        }
      )
    } catch (validationError) {
      console.error('Error validating generated TNT:', {
        matrixId,
        message: validationError.message,
        code: validationError.code,
      })

      if (validationError.response) {
        return res.status(200).json({
          valid: false,
          error:
            validationError.response.data?.error || 'TNT validation failed',
          matrixId,
        })
      } else if (validationError.code === 'ECONNREFUSED') {
        return res.status(503).json({
          valid: false,
          error: `TNT server is not available at ${process.env.TNT_SERVER_URL}`,
          matrixId,
        })
      } else {
        return res.status(500).json({
          valid: false,
          error: 'Internal server error during validation',
          matrixId,
        })
      }
    }

    // Step 4: If validation failed, return validation result
    if (!validationResponse.data.valid) {
      return res.status(200).json({
        valid: false,
        error: validationResponse.data.error || 'TNT validation failed',
        matrixId,
      })
    }

    // Step 5: If validation passed, extract species
    const speciesFormData = new FormData()
    speciesFormData.append('file', tntBuffer, {
      filename: `matrix_${matrixId}.tnt`,
      contentType: 'text/plain',
    })

    try {
      const speciesResponse = await axios.post(
        `${process.env.TNT_SERVER_URL}/tnt/species`,
        speciesFormData,
        {
          headers: {
            ...speciesFormData.getHeaders(),
          },
          timeout: 30000, // 30 second timeout
        }
      )

      // Cache the TNT content for future analysis
      const cacheKey = cacheTntContent(tntContent, matrixId)

      // Return successful validation with species list and cache key
      return res.status(200).json({
        valid: true,
        species: speciesResponse.data.species_names || [],
        species_count: speciesResponse.data.species_count || 0,
        matrixId,
        cacheKey,
      })
    } catch (speciesError) {
      console.error('Error extracting species from generated TNT:', {
        matrixId,
        message: speciesError.message,
        code: speciesError.code,
      })

      // Return validation success but species extraction failure
      return res.status(200).json({
        valid: true,
        species: [],
        error: 'Species extraction failed but TNT is valid',
        matrixId,
      })
    }
  } catch (error) {
    console.error('Error in validateMatrixAndExtractSpecies:', {
      matrixId,
      message: error.message,
      stack: error.stack,
    })

    return res.status(500).json({
      valid: false,
      error: 'Internal server error during matrix processing',
      matrixId,
    })
  }
}

/**
 * Analyze TNT content using cached data from matrix validation
 */
async function analyzeMatrixTnt(req, res) {
  const { cacheKey } = req.params

  if (!cacheKey) {
    return res.status(400).json({
      error: 'Cache key is required',
    })
  }

  try {
    // Retrieve TNT content from cache
    const cachedEntry = getTntContent(cacheKey)

    if (!cachedEntry) {
      return res.status(404).json({
        error:
          'TNT content not found in cache or has expired. Please re-validate the matrix.',
      })
    }

    // Create buffer from cached TNT content
    const tntBuffer = Buffer.from(cachedEntry.content, 'utf-8')

    // Create FormData to send to TNT server
    const formData = new FormData()
    formData.append('file', tntBuffer, {
      filename: `matrix_${cachedEntry.matrixId}.tnt`,
      contentType: 'text/plain',
    })

    if (!req.body.outgroup) {
      return res.status(400).json({
        error: 'Outgroup is required',
      })
    }

    // Add analysis parameters from request body
    formData.append('outgroup', req.body.outgroup)
    if (req.body.hold_value) {
      formData.append('hold_value', req.body.hold_value)
    }
    if (req.body.search_type) {
      formData.append('search_type', req.body.search_type)
    }

    // Add search-specific parameters
    if (req.body.search_type === 'traditional') {
      if (req.body.replications) {
        formData.append('replications', req.body.replications)
      }
      if (req.body.trees_per_replication) {
        formData.append('trees_per_replication', req.body.trees_per_replication)
      }
    } else if (req.body.search_type === 'new_technology') {
      if (req.body.iterations) {
        formData.append('iterations', req.body.iterations)
      }
    }

    // Forward request to TNT server
    const response = await axios.post(
      `${process.env.TNT_SERVER_URL}/tnt/analyze`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 300000, // 5 minute timeout for analysis
      }
    )

    // Return the analysis results (typically NEXUS format)
    return res.status(200).send(response.data)
  } catch (error) {
    console.error('Error analyzing cached TNT content:', {
      cacheKey,
      message: error.message,
      stack: error.stack,
    })

    if (error.response) {
      console.error('TNT server response error:', {
        status: error.response.status,
        data: error.response.data,
      })
      return res.status(error.response.status).json({
        error: error.response.data?.detail || 'TNT server analysis failed',
      })
    } else if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: `TNT server is not available at ${process.env.TNT_SERVER_URL}`,
      })
    } else {
      return res.status(500).json({
        error: 'Internal server error during TNT analysis',
      })
    }
  }
}

export {
  validateTntFile,
  extractSpecies,
  analyzeTntFile,
  download,
  validateMatrixAndExtractSpecies,
  analyzeMatrixTnt,
}
