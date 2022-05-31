require('dotenv').config() // this will load .env file
const Sequelize = require('sequelize')
let config = require('../config')
config = config[process.env.MB_ENV].db

const sequelize = new Sequelize(config.database, config.user, config.password, {
  logging: config.logging,
  dialect: config.dialect,
  host: config.host,
  pool: {
    max: 10,
    min: 5,
    acquire: 30000,
    idle: 10000,
  },
})

module.exports = sequelize
