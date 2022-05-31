const express = require('express')
const sequelize = require('./util/db.js')
const cors = require('cors')
const app = express()
const port = 8000
const project_route = require('./routes/projects-route')
const auth_route = require('./routes/auth-route')
const user_route = require('./routes/user-route')

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

app.use('/projects', project_route)
app.use('/auth', auth_route)
app.use('/users', user_route)

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500
  console.error(err.message, err.stack)
  res.status(statusCode).json({ message: err.message, data: err.data })
  return
})

sequelize
  .sync()
  .then((result) => {
    app.listen(process.env.PORT, () => {
      console.log(`App listening at http://localhost:${process.env.PORT}`)
    })
  })
  .catch((err) => {
    console.log(err)
  })
