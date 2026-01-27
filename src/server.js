import app from './app.js'
import http from 'http'
import process from 'node:process'

import sequelizeConn from './util/db.js'
import { startScheduler } from './util/scheduler.js'

const normalizePort = (val) => {
  var port = parseInt(val, 10)

  if (isNaN(port)) {
    // named pipe
    return val
  }

  if (port >= 0) {
    // port number
    return port
  }

  return false
}

const onError = (error) => {
  if (error.syscall !== 'listen') {
    throw error
  }
  const addr = server.address()
  const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + port
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges')
      process.exit(1)
      break
    case 'EADDRINUSE':
      console.error(bind + ' is already in use')
      process.exit(1)
      break
    default:
      throw error
  }
}

const onListening = () => {
  const addr = server.address()
  const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + port
  console.log('Listening on port ' + bind)
}

const port = normalizePort(process.env.PORT || '8000')
app.set('port', port)

const server = http.createServer(app)
server.on('error', onError)
server.on('listening', onListening)

// Test database connection - schema is managed via migrations only
// Run: npx sequelize-cli db:migrate
sequelizeConn
  .authenticate()
  .then(() => {
    console.log('Database connection established successfully.')
    return Promise.resolve()
  })
  .then(() => {
    server.listen(port)
    // Start the project stats dump scheduler (controlled by SCHEDULER_ENABLED env var)
    startScheduler()
  })
  .catch((err) => {
    console.log('Database connection error:', err)
  })
