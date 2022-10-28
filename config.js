import dotenv from 'dotenv';

// read .env file
dotenv.config();

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
    logging: console.logging
  },
}

export default config;