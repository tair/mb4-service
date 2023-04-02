import bcrypt from 'bcrypt'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { models } from '../models/init-models.js'
import { validationResult } from 'express-validator'

function isTokenExpired(token) {
  return Math.floor(new Date().getTime() / 1000) >= getTokenExpiry(token)
}

function getTokenExpiry(token) {
  const payload = Buffer.from(token.split('.')[1], 'base64')
  const expiry = JSON.parse(payload).exp // expiry in seconds
  return expiry
}

function authenticateToken(req, res, next) {
  const authHeader = req.cookies['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  // Return 401 when token is not present in the header.
  if (token == null) {
    return res.status(401).json({ message: 'Auth token not found.' })
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    // Return 403 when the token is present but invalid.
    if (err) {
      return res.status(403).json({ message: 'Auth token is invalid.' })
    }

    if (isTokenExpired(token)) {
      return res.status(403).json({ message: 'Auth token expired.' })
    }

    req.user = user
    next()
  })
}

async function maybeAuthenticateToken(req, res, next) {
  const authHeader = req.cookies['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (token == null) {
    next()
    return
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (!err) {
      req.user = user
    }
    next()
  })
}

async function login(req, res, next) {
  const errors = validationResult(req.body)
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed.')
    error.statusCode = 422
    error.data = errors.array()
    throw error
  }

  const email = req.body.email

  const user = await models.User.findOne({ where: { email: email } })

  if (!user) {
    const error = new Error('A user with this email could not be found.')
    error.statusCode = 401
    next(error)
    return
  }

  const password = req.body.password
  const passwordHash = crypto.createHash('md5').update(password).digest('hex')

  // The password stored in the MorphoBank database uses the password_hash and password_verify
  // methods which use the Crypt algorithm instead. To make this compatible with the Bcrypt
  // algorithm, we replace the algorithm part of the string, as suggested by:
  // https://stackoverflow.com/questions/23015043
  const storedPassword = user.password_hash.replace('$2y$', '$2a$')

  const passwordMatch = await bcrypt.compare(passwordHash, storedPassword)
  if (!passwordMatch) {
    const error = new Error('Wrong password!')
    error.statusCode = 401
    next(error)
    return
  }

  const userResponse = {
    email: user.email,
    user_id: user.user_id,
    name: user.name,
  }
  const accessToken = generateAccessToken(userResponse)
  const expiry = getTokenExpiry(accessToken)
  res.cookie('authorization', `Bearer ${accessToken}`, {
    expires: new Date(expiry * 1000),
    httpOnly: true,
  })
  res.status(200).json({ accessToken: accessToken, user: userResponse })
}

function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.JWT_TOKEN_EXPIRES_IN,
  })
}

export { authenticateToken, login, maybeAuthenticateToken }
