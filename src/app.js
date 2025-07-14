import cors from 'cors'
import express from 'express'
import cookieParser from 'cookie-parser'
import config from './config.js'
import projectsRouter from './routes/projects-route.js'
import publicProjectsRouter from './routes/public/projects-route.js'
import publicStatsRouter from './routes/public/stats-route.js'
import statsRouter from './routes/stats-route.js'
import authRouter from './routes/auth-route.js'
import taskRouter from './routes/tasks-route.js'
import tilepicRouter from './routes/tilepic-route.js'
import userRouter from './routes/user-route.js'
import emailRouter from './routes/email-route.js'
import homePageRouter from './routes/home-page-routes.js'
import { initializeCache } from './util/stats-cache.js'
import searchRouter from './routes/search-route.js'
import analyticsRouter from './routes/analytics-route.js'
import schedulerRouter from './routes/scheduler-route.js'
import schedulerService from './services/scheduler-service.js'

const app = express()

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader(
    'Access-Control-Allow-Methods',
    'OPTIONS, GET, POST, PUT, PATCH, DELETE'
  )
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  next()
})

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

app.use('/media', express.static(config.media.directory))

app.use('/auth', authRouter)
app.use('/projects', projectsRouter)
app.use('/public/projects', publicProjectsRouter)
app.use('/public/stats', publicStatsRouter)
app.use('/stats', statsRouter)
app.use('/users', userRouter)
app.use('/tasks', taskRouter)
app.use('/tilepic', tilepicRouter)
app.use('/home-page', homePageRouter)
app.use('/search', searchRouter)
app.use('/analytics', analyticsRouter)
app.use('/scheduler', schedulerRouter)

// Initialize stats cache
initializeCache().catch((error) => {
  console.error('Failed to initialize stats cache:', error)
})

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

export default app
