const config = {
  dev: {
    db: {
      host: 'localhost',
      user: 'morphobank',
      database: 'morphobank',
      password: 'sunnyday',
      dialect: 'mysql',
      logging: console.log,
      // logging: false,
    },
  },
}

module.exports = config
