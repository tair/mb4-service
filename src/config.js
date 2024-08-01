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
    apiDomain: process.env.ORCID_API_DOMAIN,
    clientId: process.env.ORCID_CLIENT_ID,
    cliendSecret: process.env.ORCID_CLIENT_SECRET,
    clientAccessToken: process.env.ORCID_CLIENT_ACCESS_TOKEN,
    redirect: process.env.ORCID_REDIRECT_URL,
  },
  auth: {
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
    jwtTokenExpiresIn: process.env.JWT_TOKEN_EXPIRES_IN,
  },
  email: {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
}

export default config
