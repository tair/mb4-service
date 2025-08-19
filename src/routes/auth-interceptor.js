import jwt from 'jsonwebtoken'
import { Buffer } from 'node:buffer'
import config from '../config.js'
import { models } from '../models/init-models.js'

export function authenticateToken(req, res, next) {
  // Return 401 when token is not present or in a invalid format in the header.
  if (!req.cookies['authorization']) {
    return res.status(401).json({ message: 'Auth token not found.' })
  }

  const authHeaderArray = req.cookies['authorization'].split(' ')

  const method = authHeaderArray && authHeaderArray[0]
  if (method != 'Bearer') {
    return res.status(401).json({ message: 'Invalid authentication method.' })
  }

  const token =
    authHeaderArray && authHeaderArray.length > 0 && authHeaderArray[1]
  if (token == null) {
    return res.status(401).json({ message: 'Auth token not found.' })
  }

  jwt.verify(token, config.auth.accessTokenSecret, (err, credential) => {
    // Return 403 when the token is present but invalid.
    if (err) {
      return res.status(403).json({ message: 'Auth token is invalid.' })
    }

    if (isTokenExpired(token)) {
      return res.status(403).json({ message: 'Auth token expired.' })
    }

    req.credential = credential
    next()
  })
}

export function maybeAuthenticateToken(req, res, next) {
  if (!req.cookies['authorization']) {
    next()
    return
  }

  const authHeaderArray = req.cookies['authorization'].split(' ')
  const method = authHeaderArray && authHeaderArray[0]
  if (method != 'Bearer') {
    next()
    return
  }
  const token =
    authHeaderArray && authHeaderArray.length > 0 && authHeaderArray[1]
  if (token == null) {
    next()
    return
  }

  jwt.verify(token, config.auth.accessTokenSecret, (err, credential) => {
    if (!err) {
      req.credential = credential
    }
    next()
  })
}

/**
 * Middleware that checks if the authenticated user has confirmed their profile within the last year.
 * Should be used after authenticateToken middleware.
 * Returns 449 status code with profile_confirmation_required flag if user needs to confirm profile.
 */
export async function requireProfileConfirmation(req, res, next) {
  // Skip check if user is not authenticated (credential not set)
  if (!req.credential || !req.credential.user_id) {
    return next()
  }

  try {
    const user = await models.User.findByPk(req.credential.user_id)
    
    if (!user) {
      return res.status(401).json({ message: 'User not found.' })
    }

    // Check if user has confirmed their profile within the last year
    if (!user.hasConfirmedProfile()) {
      return res.status(449).json({ 
        message: 'Profile confirmation required. Please update your profile to continue.',
        profile_confirmation_required: true,
        redirect_to_profile: true
      })
    }

    next()
  } catch (error) {
    console.error('Profile confirmation check failed:', error)
    return res.status(500).json({ message: 'Profile confirmation check failed.' })
  }
}

function isTokenExpired(token) {
  const payload = Buffer.from(token.split('.')[1], 'base64')
  const expiry = JSON.parse(payload).exp
  return Math.floor(new Date().getTime() / 1000) >= expiry
}
