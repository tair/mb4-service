import jwt from 'jsonwebtoken'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { validationResult } from 'express-validator'
import UserAuthenticationHandler from '../lib/user-authentication-handler.js'
import ReviewerAuthenticationHandler from '../lib/reviewer-authentication-handler.js'

// The types of handlers that are accepted by Morphobank.
const authenticationHandlers = [
  new UserAuthenticationHandler(),
  new ReviewerAuthenticationHandler(),
]

export async function login(req, res, next) {
  const errors = validationResult(req.body)
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed.')
    error.statusCode = 422
    error.data = errors.array()
    throw error
  }

  try {
    const email = req.body.email
    for (const handler of authenticationHandlers) {
      if (handler.canHandle(email)) {
        const password = req.body.password
        const userResponse = await handler.handle(email, password)
        const accessToken = generateAccessToken(userResponse)
        const expiry = getTokenExpiry(accessToken)
        res.cookie('authorization', accessToken, {
          expires: new Date(expiry * 1000),
          httpOnly: true,
        })
        res.status(200).json({ accessToken: accessToken, user: userResponse })
        return
      }
    }

    const error = new Error('Not a valid user name')
    error.statusCode = 401
    next(error)
  } catch (e) {
    next(e)
  }
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
