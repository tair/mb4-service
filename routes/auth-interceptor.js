import jwt from 'jsonwebtoken'
import process from 'node:process'
import { Buffer } from 'node:buffer'

export function authenticateToken(req, res, next) {
  const token = req.cookies['authorization']

  // Return 401 when token is not present in the header.
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
  const token = req.cookies['authorization']
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
