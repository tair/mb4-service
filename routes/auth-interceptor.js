import jwt from 'jsonwebtoken'
import process from 'node:process'
import { Buffer } from 'node:buffer'

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

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, credential) => {
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

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, credential) => {
    if (!err) {
      req.credential = credential
    }
    next()
  })
}

function isTokenExpired(token) {
  const payload = Buffer.from(token.split('.')[1], 'base64')
  const expiry = JSON.parse(payload).exp
  return Math.floor(new Date().getTime() / 1000) >= expiry
}
