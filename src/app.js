import cors from 'cors'
import express from 'express'
import cookieParser from 'cookie-parser'
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
  // Get the origin from the request
  const origin = req.headers.origin
  // Allow specific origins - morphobank domains
  const allowedOrigins = [
    'https://morphobank.org',              // Production proxy
    'https://beta-proxy.morphobank.org',   // Dev proxy
    'https://beta.morphobank.org',         // Beta environment
    'https://mb4-uat.morphobank.org',      // UAT environment
    config.app.frontendDomain,
    process.env.FRONTEND_URL
  ].filter(Boolean)
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  
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
    uptime: process.uptime() 
  })
})

app.use('/media', express.static(config.media.directory))

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
