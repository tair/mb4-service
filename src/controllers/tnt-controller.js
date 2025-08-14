import axios from 'axios'
import FormData from 'form-data'

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
    console.error('Error analyzing TNT file:', {
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
        error: error.response.data?.error || 'TNT server analysis failed',
      })
    } else if (error.code === 'ECONNREFUSED') {
      console.error(
        `TNT server connection refused. Check if TNT server is running at: ${process.env.TNT_SERVER_URL}`
      )
      return res.status(503).json({
        error: `TNT server is not available at ${process.env.TNT_SERVER_URL}`,
      })
    } else if (error.code === 'ECONNABORTED') {
      console.error('TNT analysis timed out:', {
        timeout: '5 minutes',
        url: process.env.TNT_SERVER_URL,
      })
      return res.status(408).json({
        error:
          'TNT analysis timed out. Please try with a smaller dataset or different parameters.',
      })
    } else {
      console.error('Unexpected error during TNT analysis:', error)
      return res.status(500).json({
        error: 'Internal server error during TNT analysis',
      })
    }
  }
}

export { validateTntFile, extractSpecies, analyzeTntFile }
