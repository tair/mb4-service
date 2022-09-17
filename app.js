const express = require('express')
const sequelize = require('./util/db.js')
const app = express()

const authRoute = require('./routes/auth-route')
const projectRoute = require('./routes/project-route')
const projectsRoute = require('./routes/projects-route')
const userRoute = require('./routes/user-route')

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

app.use('/auth', authRoute)
app.use('/home/project', projectRoute)
app.use('/projects', projectsRoute)
app.use('/users', userRoute)

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500
  console.error(err.message, err.stack)
  res.status(statusCode).json({ message: err.message, data: err.data })
  return
})

sequelize
  .sync()
  .then(() => {
    app.listen(process.env.PORT, () => {
      console.log(`App listening at http://localhost:${process.env.PORT}`)
    })
  })
  .catch((err) => {
    console.log(err)
  })
