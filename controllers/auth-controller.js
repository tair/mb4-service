require('dotenv').config() // this will load .env file
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const UserModel = require('../models/user.js')
const { validationResult } = require('express-validator')

function isTokenExpired(token) {
  const expiry = JSON.parse(atob(token.split('.')[1])).exp
  return Math.floor(new Date().getTime() / 1000) >= expiry
}

// add a middleware to authenticate
// isAuth
exports.authenticateToken = function (req, res, next) {
  // split 'Bearer TOKEN'
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  // 401 - token is not found
  if (token == null)
    return res.status(401).json({ message: 'Auth token not found.' })

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    // 403 - we see that you have a token, but its not valid
    if (err) return res.status(403).json({ message: 'Auth token is invalid.' })

    if (isTokenExpired(token))
      return res.status(403).json({ message: 'Auth token expired.' })

    // if everything OK, then we set user to the req,
    // so that it will be available to the next request ('/posts')
    req.user = user
    next()
  })
}

exports.login = function (req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed.')
    error.statusCode = 422
    error.data = errors.array()
    throw error
  }

  // Authenticate user
  // code goes here to authentication
  const email = req.body.email
  const password = req.body.password
  let loadedUser = null

  UserModel.findOne({ where: { email: email } })
    .then((user) => {
      if (!user) {
        const error = new Error('A user with this email could not be found.')
        error.statusCode = 401
        throw error
      }
      loadedUser = user
      return bcrypt.compare(password, user.password)
    })
    .then((isEqual) => {
      if (!isEqual) {
        const error = new Error('Wrong password!')
        error.statusCode = 401
        throw error
      }

      // once the authentication is done,
      // we need to serialize the user object to JWT token
      const user = {
        email: loadedUser.email,
        userId: loadedUser.user_id,
        name: loadedUser.name,
      }
      const accessToken = generateAccessToken(user)
      res.status(200).json({ accessToken: accessToken, user: user })
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500
      }
      next(err)
    })
}

function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.JWT_TOKEN_EXPIRES_IN,
  })
}
