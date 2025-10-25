import jwt from 'jsonwebtoken'
import { Buffer } from 'node:buffer'
import config from '../config.js'
import { models } from '../models/init-models.js'

export function authenticateToken(req, res, next) {
  const logPrefix = `[AUTH-DEBUG] ${req.method} ${req.path}`
  
  console.log(`${logPrefix} - Starting authentication check`)
  console.log(`${logPrefix} - Cookies present:`, Object.keys(req.cookies || {}))
  console.log(`${logPrefix} - Authorization cookie exists:`, !!req.cookies['authorization'])
  
  // Return 401 when token is not present or in a invalid format in the header.
  if (!req.cookies['authorization']) {
    console.error(`${logPrefix} - ❌ FAILED: No authorization cookie found`)
    console.error(`${logPrefix} - All cookies:`, req.cookies)
    console.error(`${logPrefix} - Headers:`, {
      cookie: req.headers.cookie,
      origin: req.headers.origin,
      referer: req.headers.referer
    })
    return res.status(401).json({ message: 'Auth token not found.' })
  }

  const authCookieValue = req.cookies['authorization']
  console.log(`${logPrefix} - Authorization cookie value (first 50 chars):`, authCookieValue?.substring(0, 50))
  
  const authHeaderArray = authCookieValue.split(' ')

  const method = authHeaderArray && authHeaderArray[0]
  console.log(`${logPrefix} - Auth method:`, method)
  
  if (method != 'Bearer') {
    console.error(`${logPrefix} - ❌ FAILED: Invalid authentication method: ${method}`)
    return res.status(401).json({ message: 'Invalid authentication method.' })
  }

  const token =
    authHeaderArray && authHeaderArray.length > 0 && authHeaderArray[1]
  
  console.log(`${logPrefix} - Token present:`, !!token)
  console.log(`${logPrefix} - Token length:`, token?.length)
  
  if (token == null) {
    console.error(`${logPrefix} - ❌ FAILED: Token is null after splitting`)
    return res.status(401).json({ message: 'Auth token not found.' })
  }

  jwt.verify(token, config.auth.accessTokenSecret, (err, credential) => {
    // Return 403 when the token is present but invalid.
    if (err) {
      console.error(`${logPrefix} - ❌ FAILED: JWT verification error:`, {
        name: err.name,
        message: err.message,
        expiredAt: err.expiredAt
      })
      return res.status(403).json({ message: 'Auth token is invalid.' })
    }

    if (isTokenExpired(token)) {
      console.error(`${logPrefix} - ❌ FAILED: Token is expired`)
      const payload = Buffer.from(token.split('.')[1], 'base64')
      const decoded = JSON.parse(payload)
      console.error(`${logPrefix} - Token expiry: ${new Date(decoded.exp * 1000).toISOString()}`)
      console.error(`${logPrefix} - Current time: ${new Date().toISOString()}`)
      return res.status(403).json({ message: 'Auth token expired.' })
    }

    console.log(`${logPrefix} - ✅ SUCCESS: Token verified for user:`, {
      user_id: credential.user_id,
      email: credential.email,
      is_anonymous: credential.is_anonymous
    })
    
    req.credential = credential
    next()
  })
}

export function maybeAuthenticateToken(req, res, next) {
  const logPrefix = `[AUTH-DEBUG-MAYBE] ${req.method} ${req.path}`
  
  console.log(`${logPrefix} - Starting optional authentication check`)
  
  if (!req.cookies['authorization']) {
    console.log(`${logPrefix} - No authorization cookie, proceeding without auth`)
    next()
    return
  }

  const authHeaderArray = req.cookies['authorization'].split(' ')
  const method = authHeaderArray && authHeaderArray[0]
  
  if (method != 'Bearer') {
    console.log(`${logPrefix} - Invalid method '${method}', proceeding without auth`)
    next()
    return
  }
  
  const token =
    authHeaderArray && authHeaderArray.length > 0 && authHeaderArray[1]
  
  if (token == null) {
    console.log(`${logPrefix} - No token found, proceeding without auth`)
    next()
    return
  }

  jwt.verify(token, config.auth.accessTokenSecret, (err, credential) => {
    if (!err) {
      console.log(`${logPrefix} - ✅ Token verified for user:`, credential.user_id)
      req.credential = credential
    } else {
      console.log(`${logPrefix} - Token verification failed:`, err.message, '- proceeding without auth')
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
