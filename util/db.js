import Sequelize from "sequelize";
import config from "../config.js";

let dbConfig = config.db

const sequelizeConn = new Sequelize(dbConfig.database, dbConfig.user, dbConfig.password, {
  logging: dbConfig.logging,
  dialect: dbConfig.dialect,
  host: dbConfig.host,
  pool: {
    max: 10,
    min: 5,
    acquire: 30000,
    idle: 10000,
  },
})

export default sequelizeConn;
