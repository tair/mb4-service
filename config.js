import dotenv from 'dotenv'
import process from 'node:process'

// read .env file
dotenv.config()

const config = {
  app: {
    name: process.env.APP_NAME,
  },
  media: {
    scheme: process.env.MEDIA_SCHEME,
    domain: process.env.MEDIA_DOMAIN,
    port: process.env.MEDIA_PORT,
    directory: process.env.MEDIA_DIRECTORY,
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
  orcid: {
    domain: process.env.ORCID_DOMAIN,
    clientId: process.env.ORCID_CLIENT_ID,
    cliendSecret: process.env.ORCID_CLIENT_SECRET,
    redirect: process.env.ORCID_REDIRECT_URL,
  },
}

export default config
