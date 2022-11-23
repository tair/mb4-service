import dotenv from 'dotenv'
import process from 'node:process'

// read .env file
dotenv.config()

const config = {
  media: {
    scheme: process.env.MEDIA_SCHEME,
    domain: process.env.MEDIA_DOMAIN,
    port: process.env.MEDIA_PORT,
  },
  db: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_SCHEMA,
    password: process.env.DB_PASSWORD,
    dialect: 'mysql',
    logging: console.logging,
  },
  datacite: {
    username: process.env.DATACITE_USERNAME,
    password: process.env.DATACITE_PASSWORD,
    shoulder: process.env.DATACITE_SHOULDER,
    hostname: process.env.DATACITE_HOSTNAME,
    urlPath: process.env.DATACITE_URL_PATH,
  },
}

export default config
