import Sequelize from 'sequelize'
import config from '../config.js'

const dbConfig = config.db

const sequelizeConn = new Sequelize(
  dbConfig.database,
  dbConfig.user,
  dbConfig.password,
  {
    logging: dbConfig.logging,
    dialect: dbConfig.dialect,
    host: dbConfig.host,
    pool: {
      max: 10,
      min: 5,
      acquire: 60000,  // Increased from 30s to 60s
      idle: 10000,
    },
    dialectOptions: {
      connectTimeout: 60000,  // Connection timeout in milliseconds
      charset: 'utf8mb4',     // Set charset
    },
    retry: {
      match: [
        /ETIMEDOUT/,
        /EHOSTUNREACH/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /ESOCKETTIMEDOUT/,
        /EHOSTUNREACH/,
        /EPIPE/,
        /EAI_AGAIN/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/
      ],
      max: 3
    },
  }
)

export default sequelizeConn
