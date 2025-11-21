import cors from 'cors'
import express from 'express'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import axios from 'axios'
import FormData from 'form-data'
import config from './config.js'
import projectsRouter from './routes/projects-route.js'
import publicProjectsRouter from './routes/public/projects-route.js'
import publicStatsRouter from './routes/public/stats-route.js'
import publicMediaServeRouter from './routes/public/media-serve-route.js'
import publicDocumentServeRouter from './routes/public/document-serve-route.js'
import statsRouter from './routes/stats-route.js'
import authRouter from './routes/auth-route.js'
import taskRouter from './routes/tasks-route.js'
import tilepicRouter from './routes/tilepic-route.js'
import userRouter from './routes/user-route.js'
import emailRouter from './routes/email-route.js'
import homePageRouter from './routes/home-page-routes.js'
import { initializeCache } from './util/stats-cache.js'
import { initializeTntCache } from './util/tnt-cache.js'
import searchRouter from './routes/search-route.js'
import analyticsRouter from './routes/analytics-route.js'
import schedulerRouter from './routes/scheduler-route.js'
import tntRouter from './routes/tnt-route.js'
import schedulerService from './services/scheduler-service.js'
import s3Router from './routes/s3-route.js'
import { duplicationRequestRouter } from './routes/duplication-request-route.js'
import apiServiceRouter from './routes/api-service-route.js'
import { trackSession } from './lib/session-middleware.js'
import { gracefulShutdown } from './controllers/analytics-controller.js'
import loggingService from './services/logging-service.js'

const app = express()

// Trust proxy to get real IP addresses from proxy headers
// This is essential for Docker deployments behind reverse proxies
app.set('trust proxy', true)

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader(
    'Access-Control-Allow-Methods',
    'OPTIONS, GET, POST, PUT, PATCH, DELETE'
  )
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-session-key, x-session-fingerprint'
  )
  next()
})

// Session tracking middleware (applied to all routes)
app.use(trackSession)

app.use(cors())
app.use('/email', express.json({ limit: '10mb' }))
app.use('/email', emailRouter)
app.use(express.json())
app.use(cookieParser())
app.use(
  express.urlencoded({
    extended: true,
  })
)

app.get('/', (req, res) => {
  res.json({ message: 'The API service is alive!' })
})

// Health check endpoint for Docker health checks
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

app.use('/media', express.static(config.media.directory))

// Configure multer for memory storage (for PDF processing)
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit for PDFs
  },
})

// PDF processing handler function
const processPdfHandler = async (req, res) => {
  console.log('PDF processing route hit - NO AUTH REQUIRED')
  try {
    // Validate PDF file
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' })
    }

    // Extract form fields
    const {
      total_characters,
      page_range,
      zero_indexed,
      extraction_model,
      evaluation_model,
    } = req.body

    // Create form data for curator service
    const formData = new FormData()
    formData.append('pdf_file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    })

    // total_characters must be an integer - use large number (1000) if not provided
    const totalChars = total_characters ? parseInt(total_characters, 10) : 1000
    if (isNaN(totalChars)) {
      return res
        .status(400)
        .json({ error: 'total_characters must be a valid integer' })
    }
    formData.append('total_characters', totalChars.toString())

    // Add optional fields
    if (page_range) {
      formData.append('page_range', page_range)
    }
    if (zero_indexed !== undefined) {
      formData.append('zero_indexed', zero_indexed)
    }
    if (extraction_model) {
      formData.append('extraction_model', extraction_model)
    }
    if (evaluation_model) {
      formData.append('evaluation_model', evaluation_model)
    }

    // Get curator service URL from environment or use default
    const curatorServiceUrl =
      process.env.CURATOR_SERVICE_URL || 'http://localhost:8001'

    console.log(
      `Calling curator service at: ${curatorServiceUrl}/api/process-pdf`
    )

    // Call curator service
    const response = await axios.post(
      `${curatorServiceUrl}/api/process-pdf`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 300000, // 5 minute timeout for large PDFs
      }
    )

    // Return curator service response
    return res.status(200).json(response.data)
  } catch (error) {
    // Log only essential error information, not the entire error object
    const errorInfo = {
      message: error.message,
      code: error.code,
      ...(error.response && {
        status: error.response.status,
        statusText: error.response.statusText,
      }),
    }
    console.error('Error processing PDF:', JSON.stringify(errorInfo, null, 2))

    // Handle DNS/network errors (hostname not found - containers not on same network)
    if (error.code === 'ENOTFOUND' || error.message?.includes('ENOTFOUND')) {
      const curatorServiceUrl =
        process.env.CURATOR_SERVICE_URL || 'http://localhost:8001'
      return res.status(503).json({
        error: 'Curator service hostname not found',
        message: `Cannot resolve hostname for curator service: ${curatorServiceUrl}`,
        details:
          'The curator service container may not be on the same Docker network. Ensure both containers are on the shared_network.',
        attempted_url: curatorServiceUrl,
        code: error.code,
        suggestion:
          'Make sure the curator service is running and on the same Docker network (shared_network). Restart both containers after updating docker-compose files.',
      })
    }

    // Handle connection refused errors (service not running or wrong URL)
    if (
      error.code === 'ECONNREFUSED' ||
      error.message?.includes('ECONNREFUSED')
    ) {
      const curatorServiceUrl =
        process.env.CURATOR_SERVICE_URL || 'http://localhost:8001'
      const isDocker =
        process.env.DOCKER_ENV || process.env.NODE_ENV === 'production'

      let helpMessage =
        'The curator service may not be running, or CURATOR_SERVICE_URL environment variable may be incorrect.'
      if (isDocker) {
        helpMessage +=
          ' In Docker: if curator is in another container on the same network, use the container name (e.g., http://mb4-curator-api-dev:8001). If curator is on the host machine, use http://host.docker.internal:8001'
      }

      return res.status(503).json({
        error: 'Curator service is not available',
        message: `Cannot connect to curator service at ${curatorServiceUrl}`,
        details: helpMessage,
        attempted_url: curatorServiceUrl,
        code: error.code,
        suggestion: isDocker
          ? 'Try setting CURATOR_SERVICE_URL=http://mb4-curator-api-dev:8001 or http://host.docker.internal:8001'
          : 'Ensure the curator service is running on port 8001',
      })
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return res.status(504).json({
        error: 'Request timeout',
        message: 'The curator service took too long to respond',
        details:
          'The PDF processing may be taking longer than expected. Try again or contact support.',
      })
    }

    // Handle curator service errors (service responded but with error)
    if (error.response) {
      return res.status(error.response.status).json({
        error: error.response.data.detail || 'Error from curator service',
        details: error.response.data,
      })
    }

    // Handle other network/connection errors
    return res.status(500).json({
      error: 'Failed to communicate with curator service',
      message: error.message,
      code: error.code,
      details:
        'Check that the curator service is running and CURATOR_SERVICE_URL is correctly configured',
    })
  }
}

// PDF processing route for curator service (NO AUTH REQUIRED)
// Register at /projects/process-pdf BEFORE the projects router
app.post(
  '/projects/process-pdf',
  uploadMemory.single('pdf_file'),
  processPdfHandler
)

// Also register at /curator/process-pdf as backup
app.post(
  '/curator/process-pdf',
  uploadMemory.single('pdf_file'),
  processPdfHandler
)

app.use('/auth', authRouter)
app.use('/projects', projectsRouter)
app.use('/public/projects', publicProjectsRouter)
app.use('/public/stats', publicStatsRouter)
app.use('/public/media', publicMediaServeRouter)
app.use('/public/documents', publicDocumentServeRouter)
app.use('/stats', statsRouter)
app.use('/users', userRouter)
app.use('/tasks', taskRouter)
app.use('/tilepic', tilepicRouter)
app.use('/home-page', homePageRouter)
app.use('/search', searchRouter)
app.use('/analytics', analyticsRouter)
app.use('/scheduler', schedulerRouter)
app.use('/s3', s3Router)
app.use('/tnt', tntRouter)
app.use('/duplication-requests', duplicationRequestRouter)
app.use('/service', apiServiceRouter)

// Initialize stats cache
initializeCache().catch((error) => {
  console.error('Failed to initialize stats cache:', error)
})

// Initialize TNT cache
initializeTntCache()

// Start unified logging service (handles analytics + sessions)
loggingService.start()

// Start scheduler service if enabled
// Default to true if undefined, only disable if explicitly set to 'false'
const schedulerEnabled = process.env.SCHEDULER_ENABLED !== 'false'
if (schedulerEnabled) {
  schedulerService.start()
  console.log(
    `Scheduler service is enabled and started (SCHEDULER_ENABLED=${
      process.env.SCHEDULER_ENABLED || 'undefined, defaulting to true'
    })`
  )
} else {
  console.log(
    'Scheduler service is disabled via SCHEDULER_ENABLED environment variable'
  )
}

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500
  console.error(err.message, err.stack)
  if (req.xhr) {
    res.status(statusCode).json({ message: err.message, data: err.data })
  } else {
    next(err)
  }
})

// Graceful shutdown handling for analytics buffer
const handleShutdown = async (signal) => {
  console.log(`\n[${signal}] Graceful shutdown initiated...`)

  try {
    // Stop the scheduler service
    if (schedulerService.isRunning) {
      schedulerService.stop()
      console.log('✓ Scheduler service stopped')
    }

    // Stop logging service and flush all buffers
    await gracefulShutdown()
    console.log('✓ Logging service stopped and all buffers flushed')

    console.log('Graceful shutdown complete. Exiting...')
    process.exit(0)
  } catch (error) {
    console.error('Error during graceful shutdown:', error)
    process.exit(1)
  }
}

// Handle various shutdown signals
process.on('SIGTERM', () => handleShutdown('SIGTERM'))
process.on('SIGINT', () => handleShutdown('SIGINT'))
process.on('SIGUSR2', () => handleShutdown('SIGUSR2')) // nodemon restart

export default app
