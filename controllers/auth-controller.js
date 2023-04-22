import bcrypt from 'bcrypt'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { models } from '../models/init-models.js'
import { validationResult } from 'express-validator'

export async function login(req, res, next) {
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
  res.cookie('authorization', accessToken, {
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

function getTokenExpiry(token) {
  const payload = Buffer.from(token.split('.')[1], 'base64')
  const expiry = JSON.parse(payload).exp // expiry in seconds
  return expiry
}