import express from 'express';
import projectRouter from './routes/project-route.js';
import projectsRouter from './routes/projects-route.js';
import authRouter from './routes/auth-route.js';
import userRouter from './routes/user-route.js';

const app = express()

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader(
    'Access-Control-Allow-Methods',
    'OPTIONS, GET, POST, PUT, PATCH, DELETE'
  )
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  next()
})

app.use(express.json())
app.use(
  express.urlencoded({
    extended: true,
  })
)

app.get('/', (req, res) => {
  res.json({ message: 'The API service is alive!' })
})

app.use('/auth', authRouter)
app.use('/home/project', projectRouter)
app.use('/projects', projectsRouter)
app.use('/users', userRouter)

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500
  console.error(err.message, err.stack)
  res.status(statusCode).json({ message: err.message, data: err.data })
  return
})

export default app;