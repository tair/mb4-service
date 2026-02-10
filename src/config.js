import dotenv from 'dotenv'
import process from 'node:process'

// read .env file
dotenv.config()

const config = {
  app: {
    name: process.env.APP_NAME,
    frontendDomain: process.env.APP_FRONTEND_DOMAIN,
  },
  media: {
    scheme: process.env.MEDIA_SCHEME,
    domain: process.env.MEDIA_DOMAIN,
    port: process.env.MEDIA_PORT,
    directory: process.env.MEDIA_DIRECTORY,
    newDomain: process.env.NEW_MEDIA_DOMAIN,
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
    // API domain for all ORCID API calls (Member API - requires ORCID membership)
    apiDomain: process.env.ORCID_API_DOMAIN,
    clientId: process.env.ORCID_CLIENT_ID,
    cliendSecret: process.env.ORCID_CLIENT_SECRET,
    clientAccessToken: process.env.ORCID_CLIENT_ACCESS_TOKEN,
    redirect: process.env.ORCID_REDIRECT_URL,
    // Enable ORCID Works feature (requires Member API credentials with write scope)
    worksEnabled: process.env.ORCID_WORKS_ENABLED === 'true',
  },
  auth: {
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
    jwtTokenExpiresIn: process.env.JWT_TOKEN_EXPIRES_IN,
  },
  aws: {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    defaultBucket: process.env.AWS_S3_DEFAULT_BUCKET,
  },
  email: {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  cipres: {
    url: process.env.CIPRES_URL,
    key: process.env.CIPRES_KEY,
    username: process.env.CIPRES_USERNAME,
    password: process.env.CIPRES_PASSWORD,
  },
  curator: {
    url: process.env.CURATOR_API_URL || 'http://localhost:8001',
  },
}

export default config
